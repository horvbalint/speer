use actix::Addr;
use actix_web::{HttpResponse, Responder, error::*, get, http::StatusCode, post, web::{Path, Json, Data}, cookie::Cookie, HttpRequest, HttpMessage};
use futures::TryStreamExt;
use mongodb::{Collection, Database, bson::{doc, oid::ObjectId}};
use serde::Deserialize;
use jsonwebtoken::{encode, Header, EncodingKey};
use std::{fs::remove_file, time::{SystemTime, UNIX_EPOCH}, str::FromStr};
use std::path::PathBuf;
use actix_files::NamedFile;
use image::imageops::FilterType;
use crate::{CurrDir, ws::{Server, ConnectedIds, Dispatch}, EnvVars};

use crate::schemas::{User, MinimalUser, MeUser};
use crate::mail;
use crate::schemas::Confirm;
use crate::jwt::JWT;
use crate::utils;

extern crate bcrypt;
use bcrypt::{verify, hash};

extern crate image;

#[derive(Deserialize)]
pub struct LoginBody {
    email: String,
    password: String
}

#[derive(Deserialize)]
pub struct RegisterBody {
    email: String,
    username: String,
    password: String
}

#[post("/register")]
pub async fn register_handler(
    body: Json<RegisterBody>,
    users_coll: Data<Collection<User>>,
    confirms_coll: Data<Collection<Confirm>>,
    env_vars: Data<EnvVars>,
) -> Result<impl Responder, Error> {
    let filter = doc!{"email": &body.email};
    let user_exists = users_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("")))?
        .is_some();
    if user_exists {return Err(ErrorBadRequest("Email in use"));}

    let password = hash(&body.password, 10)
        .or(Err(ErrorInternalServerError("")))?;

    let user = User {
        email: body.email.to_string(),
        username: body.username.to_string(),
        password: password.to_string(),
        ..Default::default()
    };
    let user_id = users_coll.insert_one(user, None).await
        .or(Err(ErrorInternalServerError("Failed to create user")))?
        .inserted_id
        .as_object_id()
        .ok_or(ErrorInternalServerError(""))?
        .clone();
    
    let token = encode(&Header::default(), &body.email, &EncodingKey::from_secret(env_vars.confirm_secret.as_ref()))
        .or(Err(ErrorInternalServerError("")))?;
    let confirm = Confirm {
        _id: ObjectId::new(),
        user: user_id.clone(),
        token: token.clone(),
    };
    confirms_coll.insert_one(confirm, None).await
        .or(Err(ErrorInternalServerError("Failed to create user")))?;


    mail::send_confirmation(&body.username, &body.email, &token, &env_vars).await
        .or(Err(ErrorInternalServerError("Failed to send confirmation email")))?;

    Ok("")
}

#[post("/login")]
pub async fn login_handler(
    credentials: Json<LoginBody>,
    users_coll: Data<Collection<User>>,
    env_vars: Data<EnvVars>
) -> Result<impl Responder, Error> {
    let filter = doc!{"email": &credentials.email};

    let user = users_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("Incorrect credentials")))?
        .ok_or(ErrorInternalServerError("Incorrect credentials"))?;

    let verified = verify(&credentials.password, user.password.as_str())
        .or(Err(ErrorUnauthorized("Password does not match")))?;

    if !verified { return Err(ErrorUnauthorized("Password does not match")) }
    if user.deleted { return Err(ErrorUnauthorized("User deactivated")) }
    if !user.confirmed { return Err(ErrorUnauthorized("Email not confirmed")) }

    let current_utc = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let token_claims = JWT::new(user._id, current_utc + (24 * 60 * 60));
    let token = encode(&Header::default(), &token_claims, &EncodingKey::from_secret(env_vars.cookie_secret.as_ref()))
        .or(Err(ErrorInternalServerError("")))?;

    let cookie = Cookie::build("speer", token)
        .secure(true)
        .http_only(true)
        .finish();

    Ok(
        HttpResponse::build(StatusCode::OK)
        .cookie(cookie)
        .body("Logged in")
    )
}

#[post("/logout")]
pub async fn logout_handler(req: HttpRequest) -> Result<impl Responder, Error> {
    let mut builder = HttpResponse::build(StatusCode::OK);

    if let Some(ref cookie) = req.cookie("speer") {
        builder.del_cookie(cookie);
    }

    Ok(builder.finish())
}

#[post("/confirm/{token}")]
pub async fn confirm_handler(
    Path(token): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    uesers_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let filter = doc!{"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("Invalid token")))?
        .ok_or(ErrorInternalServerError("Invalid token"))?;

    let filter = doc!{"_id": confirm.user};
    let update = doc!{"$set": {"confirmed": true}};
    uesers_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("")))?;

    let filter = doc!{"_id": confirm._id};
    confirms_coll.delete_one(filter, None).await.ok();

    Ok("ok")
}

#[post("/cancel/{token}")]
pub async fn cancel_handler(
    Path(token): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let filter = doc!{"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("Invalid token")))?
        .ok_or(ErrorInternalServerError("Invalid token"))?;

    let filter = doc!{"_id": confirm.user, "confirmed": false};
    users_coll.delete_one(filter, None).await
        .or(Err(ErrorInternalServerError("Failed to cancel token")))?;

    let filter = doc!{"_id": confirm._id};
    confirms_coll.delete_one(filter, None).await.ok();

    Ok("ok")
}

#[post("/resendConfirmation/{email}")]
pub async fn resend_confirmation_handler(
    Path(email): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
    env_vars: Data<EnvVars>
) -> Result<impl Responder, Error> {
    let filter = doc!{
        "email": email,
        "confirmed": false,
        "deleted": false
    };
    
    let user = users_coll.find_one(filter, None).await
        .or(Err(ErrorBadRequest("Invalid email")))?
        .ok_or(ErrorBadRequest("Invalid email"))?;
    
    let filter = doc!{"user": user._id};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(ErrorBadRequest("Failed to resend email")))?
        .ok_or(ErrorBadRequest("Failed to resend email"))?;

    mail::send_confirmation(&user.username, &user.email, &confirm.token, &env_vars).await
        .or(Err(ErrorInternalServerError("Failed to send confirmation email")))?;

    Ok("ok")
}

#[post("/avatar")]
pub async fn avatar_handler(
    mut parts: awmp::Parts,
    users_coll: Data<Collection<User>>,
    curr_dir : Data<CurrDir>,
    user: User,
) -> Result<impl Responder, Error> {
    let files_path = format!("{}/files", curr_dir.path);

    let uploaded_file = parts.files.take("avatar").pop()
        .ok_or(ErrorBadRequest("No avatar provided"))?;

    let extension = uploaded_file.original_file_name().and_then(|name| name.split('.').next_back()).unwrap_or("avatar");
    let file_name = utils::generate_random_string(32);
    let full_file_name = format!("{}.{}", file_name, extension);

    let path = PathBuf::from(format!("{}/{}", files_path, full_file_name));

    let save_res = uploaded_file.persist_in("/tmp")
        .or(Err(ErrorInternalServerError("Failed to save image")))?;

    let tmp_path = save_res.to_str().unwrap();
    
    image::open(&tmp_path)
        .and_then(|img| {
            let tmp = img.resize_to_fill(200, 200, FilterType::Triangle);
            tmp.save(path)
        })
        .or(Err(ErrorInternalServerError("")))?;

    let filter = doc!{"_id": user._id};
    let update = doc!{"$set": {"avatar": &full_file_name}};
    users_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("Could not update user profile")))?;
        
    remove_file(tmp_path).ok();
    if user.avatar != "avatar.jpg" {
        let path = PathBuf::from(format!("{}/{}", files_path, user.avatar));
        remove_file(path).ok();
    }

    Ok(full_file_name)
}

#[get("/me")]
pub async fn me_handler(
    db: Data<Database>,
    user: User,
) -> Result<impl Responder, Error> {
    let filter = doc!{"_id": user._id};

    let user = db.collection::<MeUser>("users").find_one(filter, None).await
        .or(Err(ErrorInternalServerError("")))?
        .ok_or(ErrorBadRequest(""))?;

    Ok(Json(user))
}

#[get("/onlines")]
pub async fn onlines_handler(
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let onlines = ws_addr.send(ConnectedIds).await
        .or(Err(ErrorInternalServerError("")))?
        .ok_or(ErrorInternalServerError(""))?;

    let friend_onlines: Vec<String> = onlines.into_iter()
        .filter(|id| user.friends.contains(id))
        .map(|id| id.to_string())
        .collect();

    Ok(Json(friend_onlines))
}

#[get("/online/{id}")]
pub async fn online_handler(
    Path(id): Path<String>,
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    if !user.friends.iter().any(|f| f.to_string() == id) {
        return Err(ErrorForbidden("Not a friend"));
    }

    let onlines = ws_addr.send(ConnectedIds).await
        .or(Err(ErrorInternalServerError("")))?
        .ok_or(ErrorInternalServerError(""))?;

    let is_online = onlines.iter().any(|o_id| o_id.to_string() == id);
    Ok(Json(is_online))
}

#[get("/user/{email}")]
pub async fn user_by_email_handler(
    Path(email): Path<String>,
    minimal_users_coll: Data<Collection<MinimalUser>>,
    user: User,
) -> Result<impl Responder, Error> {
    let filter = doc!{
        "email": email,
        "deleted": false,
        "confirmed": true,
        "$and": [
            {"_id": {"$nin": user.friends}},
            {"_id": {"$ne": user._id}},
        ]
    };

    let user = minimal_users_coll.find_one(filter, None).await
       .or(Err(ErrorInternalServerError("")))?;

    Ok(Json(user))
}

#[get("/friends")]
pub async fn friends_handler(
    minimal_users_coll: Data<Collection<MinimalUser>>,
    user: User,
) -> Result<impl Responder, Error> {
    let filter = doc!{
        "deleted": false,
        "confirmed": true,
        "_id": {"$in": user.friends}
    };

    let users: Vec<MinimalUser> = minimal_users_coll.find(filter, None).await
        .or(Err(ErrorInternalServerError("")))?
        .try_collect().await
        .or(Err(ErrorInternalServerError("")))?;

    Ok(Json(users))
}

#[post("/request/{id}")]
pub async fn request_id_handler(
    Path(id): Path<String>,
    users_coll: Data<Collection<User>>,
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = ObjectId::from_str(&id)
        .or(Err(ErrorBadRequest("Not an id")))?;

    if user._id == id {
        return Err(ErrorBadRequest("Make peace with yourself"))
    }

    let filter = doc! {
        "deleted": false,
        "confirmed": true,
        "_id": id
    };

    let req_user = users_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("")))?
        .ok_or(ErrorBadRequest("User not found"))?;

    if req_user.friends.contains(&user._id) {
        return Err(ErrorBadRequest("Already friend"))
    }

    let filter = doc!{"_id": &req_user._id};
    let update = doc!{"$addToSet": {"requests": user._id}};
    users_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("")))?;

    let event = Dispatch {
        event: "request".to_string(),
        payload: doc!{
            "_id": user._id.to_string(),
            "username": user.username,
            "email": user.email,
            "avatar": user.avatar,
        },
        filter: vec![req_user._id]
    };
    
    ws_addr.send(event).await.ok();
        
    Ok("")
}

#[get("/request")]
pub async fn request_handler(
    db: Data<Database>,
    user: User,
) -> Result<impl Responder, Error> {
    let filter = doc! {
        "deleted": false,
        "confirmed": true,
        "_id": {"$in": user.requests}
    };


    let req_users: Vec<MinimalUser> = db.collection::<MinimalUser>("users").find(filter, None).await
        .or(Err(ErrorInternalServerError("")))?
        .try_collect().await
        .or(Err(ErrorInternalServerError("")))?;

    Ok(Json(req_users))
}

#[post("/accept/{id}")]
pub async fn accept_id_handler(
    Path(id): Path<String>,
    users_coll: Data<Collection<User>>,
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = ObjectId::from_str(&id)
        .or(Err(ErrorBadRequest("Not an id")))?;

    if !user.requests.iter().any(|r| r == &id) {
        return Err(ErrorBadRequest("Not in requests"));
    }

    let filter = doc! {"_id": user._id};
    let update = doc! {
        "$pull": {"requests": id},
        "$addToSet": {"friends": id}
    };
    users_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("")))?;


    let filter = doc! {"_id": id};
    let update = doc! {"$addToSet": {"friends": user._id}};
    users_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("")))?;

    let event = Dispatch {
        event: "friend".to_string(),
        payload: doc!{
            "_id": user._id.to_string(),
            "username": user.username,
            "email": user.email,
            "avatar": user.avatar,
        },
        filter: vec![id]
    };
    
    ws_addr.send(event).await.ok();

    // TODO: Push-notification

    Ok("")
}

#[post("/decline/{id}")]
pub async fn decline_id_handler(
    Path(id): Path<String>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = ObjectId::from_str(&id)
        .or(Err(ErrorBadRequest("Not an id")))?;

    if !user.requests.iter().any(|r| r == &id) {
        return Err(ErrorBadRequest("Not in requests"));
    }

    let filter = doc! {"_id": user._id};
    let update = doc! {"$pull": {"requests": id}};
    users_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("")))?;

    Ok("")
}

#[get("/changelog/{version}")]
pub async fn changelog_version_handler(
    Path(version): Path<String>,
    changelog: Data<serde_json::Map<String, serde_json::Value>>,
    _user: User,
) -> Result<impl Responder, Error> {
    let log_for_version = changelog.get(&version);
    if log_for_version.is_none() {
        return Err(ErrorBadRequest("No such version"));
    }

    let new_versions = changelog.keys().take_while(|v| v != &&version);
    let mut changes = serde_json::Map::<String, serde_json::Value>::new();

    for v in new_versions {
        changes.insert(v.clone(), changelog[v].clone());
    }

    Ok(Json(changes))
}

#[get("/changelog")]
pub async fn changelog_handler(
    changelog: Data<serde_json::Map<String, serde_json::Value>>,
    _user: User,
) -> Result<impl Responder, Error> {
    let res = (**changelog).clone();

    Ok(Json(res))
}

#[get("/breaking/{version}")]
pub async fn breaking_version_handler(
    Path(version): Path<String>,
    changelog: Data<serde_json::Map<String, serde_json::Value>>,
    _user: User,
) -> Result<impl Responder, Error> {
    let log_for_version = changelog.get(&version);
    if log_for_version.is_none() {
        return Err(ErrorBadRequest("No such version"));
    }

    let new_versions = changelog.keys()
        .take_while(|v| v != &&version)
        .any(|v| changelog[v]["type"] == "breaking");

    Ok(Json(new_versions))
}

#[get("/static/{file}")]
pub async fn files_handler(
    Path(file): Path<String>,
    curr_dir : Data<CurrDir>,
    _user: User,
) -> Result<impl Responder, Error> {
    let path = PathBuf::from(format!("{}/files/{}", curr_dir.path, file));
    
    let res = NamedFile::open(path)
        .or(Err(ErrorNotFound(file)))?;
    
    Ok(res)
}