use actix::Addr;
use actix_web::{HttpResponse, Responder, error::*, get, http::StatusCode, post, web::{Path, Json, Data}, cookie::Cookie, HttpRequest, delete};
use futures::TryStreamExt;
use mongodb::{Collection, Database, bson::{doc, oid::ObjectId}};
use serde::Deserialize;
use serde_json::{Map as SerdeMap, Value as SerdeValue};
use jsonwebtoken::{encode, Header, EncodingKey};
use std::{time::{SystemTime, UNIX_EPOCH}, str::FromStr, fs};
use std::path::PathBuf;
use actix_files::NamedFile;
use image::imageops::FilterType;
use unicode_segmentation::UnicodeSegmentation;

use crate::{CurrDir, ws::{Server, ConnectedIds, Dispatch}, EnvVars, schemas::{Device, Feedback}};
use crate::schemas::{User, MinimalUser, MeUser};
use crate::mail;
use crate::schemas::Confirm;
use crate::jwt::Jwt;
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

#[derive(Deserialize)]
pub struct PingBody {
    id: ObjectId,
    message: String,
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
        .map_err(|_| ErrorInternalServerError(""))?
        .is_some();
    if user_exists {return Err(ErrorBadRequest("Email in use"));}

    let password = hash(&body.password, 10)
        .map_err(|_| ErrorInternalServerError(""))?;

    let user = User {
        email: body.email.to_string(),
        username: body.username.to_string(),
        password: password.to_string(),
        ..Default::default()
    };
    let insert_result = users_coll.insert_one(&user, None).await
        .map_err(|_| ErrorInternalServerError("Failed to create user"))?;
        
    let inserted_id = insert_result.inserted_id.as_object_id().unwrap().to_string();
    let token = encode(&Header::default(), &inserted_id, &EncodingKey::from_secret(env_vars.confirm_secret.as_ref()))
        .map_err(|_| ErrorInternalServerError(""))?;

    let confirm = Confirm {
        _id: ObjectId::new(),
        user: user._id,
        token: token.clone(),
    };
    confirms_coll.insert_one(confirm, None).await
        .map_err(|_| ErrorInternalServerError("Failed to create user"))?;

    mail::send_confirmation(&body.username, &body.email, &token, &env_vars).await
        .map_err(|_| ErrorInternalServerError("Failed to send confirmation email"))?;

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
        .map_err(|_| ErrorBadRequest("Incorrect credentials"))?
        .ok_or_else(|| ErrorBadRequest("Incorrect credentials"))?;

    let verified = verify(&credentials.password, user.password.as_str())
        .map_err(|_| ErrorUnauthorized("Password does not match"))?;

    if !verified { return Err(ErrorUnauthorized("Password does not match")) }
    if user.deleted { return Err(ErrorUnauthorized("User deactivated")) }
    if !user.confirmed { return Err(ErrorUnauthorized("Email not confirmed")) }

    let current_utc = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let token_claims = Jwt::new(user._id, current_utc + (24 * 60 * 60));
    let token = encode(&Header::default(), &token_claims, &EncodingKey::from_secret(env_vars.cookie_secret.as_ref()))
        .map_err(|_| ErrorInternalServerError(""))?;

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
    let mut response = HttpResponse::build(StatusCode::OK).finish();

    if let Some(ref cookie) = req.cookie("speer") {
        response.add_removal_cookie(cookie)
            .map_err(|_| ErrorInternalServerError("Failed to remove cookie"))?;
    }
    
    Ok(response)
}

#[post("/confirm/{token}")]
pub async fn confirm_handler(
    params: Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let token = params.into_inner();

    let filter = doc!{"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .map_err(|_| ErrorInternalServerError("Invalid token"))?
        .ok_or_else(|| ErrorInternalServerError("Invalid token"))?;

    let filter = doc!{"_id": confirm.user};
    let update = doc!{"$set": {"confirmed": true}};

    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;

    tokio::spawn(async move {
        let filter = doc!{"_id": confirm._id};
        confirms_coll.delete_one(filter, None).await.ok();
    });

    Ok("ok")
}

#[post("/cancel/{token}")]
pub async fn cancel_handler(
    params: Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let token = params.into_inner();

    let filter = doc!{"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .map_err(|_| ErrorInternalServerError("Invalid token"))?
        .ok_or_else(|| ErrorInternalServerError("Invalid token"))?;

    let filter = doc!{"_id": confirm.user, "confirmed": false};
    users_coll.delete_one(filter, None).await
        .map_err(|_| ErrorInternalServerError("Failed to cancel token"))?;

    tokio::spawn(async move {
        let filter = doc!{"_id": confirm._id};
        confirms_coll.delete_one(filter, None).await.ok();
    });

    Ok("ok")
}

#[post("/resendConfirmation/{email}")]
pub async fn resend_confirmation_handler(
    params: Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
    env_vars: Data<EnvVars>
) -> Result<impl Responder, Error> {
    let email = params.into_inner();
    let filter = doc!{
        "email": email,
        "confirmed": false,
        "deleted": false
    };
    
    let user = users_coll.find_one(filter, None).await
        .map_err(|_| ErrorBadRequest("Invalid email"))?
        .ok_or_else(|| ErrorBadRequest("Invalid email"))?;
    
    let filter = doc!{"user": user._id};
    let confirm = confirms_coll.find_one(filter, None).await
        .map_err(|_| ErrorBadRequest("Failed to resend email"))?
        .ok_or_else(|| ErrorBadRequest("Failed to resend email"))?;

    mail::send_confirmation(&user.username, &user.email, &confirm.token, &env_vars).await
        .map_err(|_| ErrorInternalServerError("Failed to send confirmation email"))?;

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
        .ok_or_else(|| ErrorBadRequest("No avatar provided"))?;

    let extension = utils::get_file_extension(&uploaded_file, "avatar");
    let file_name = utils::generate_random_string(32);
    let full_file_name = format!("{}.{}", file_name, extension);

    let path = PathBuf::from(format!("{}/{}", files_path, full_file_name));

    let save_res = uploaded_file.persist_in("/tmp")
        .map_err(|_| ErrorInternalServerError("Failed to save image"))?;

    let tmp_path = save_res.to_str().unwrap();
    image::open(&tmp_path)
        .map_err(|_| ErrorInternalServerError("Failed to compress image"))?
        .resize_to_fill(200, 200, FilterType::Triangle)
        .save(path)
        .map_err(|_| ErrorInternalServerError("Failed to compress image"))?;

    let filter = doc!{"_id": user._id};
    let update = doc!{"$set": {"avatar": &full_file_name}};
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError("Could not update user profile"))?;
        
    fs::remove_file(tmp_path).ok();
    if user.avatar != "avatar.jpg" {
        let path = PathBuf::from(format!("{}/{}", files_path, user.avatar));
        fs::remove_file(path).ok();
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
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorBadRequest(""))?;

    Ok(Json(user))
}

#[get("/onlines")]
pub async fn onlines_handler(
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let onlines = ws_addr.send(ConnectedIds).await
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorInternalServerError(""))?;

    let friend_onlines: Vec<String> = onlines.into_iter()
        .filter(|id| user.friends.contains(id))
        .map(|id| id.to_hex())
        .collect();

    Ok(Json(friend_onlines))
}

#[get("/online/{id}")]
pub async fn online_handler(
    params: Path<String>,
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = ObjectId::parse_str(params.into_inner())
        .map_err(|_| ErrorBadRequest("Not an id"))?;

    if !user.friends.contains(&id) {
        return Err(ErrorForbidden("Not a friend"));
    }

    let onlines = ws_addr.send(ConnectedIds).await
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorInternalServerError(""))?;

    let is_online = onlines.contains(&id);
    Ok(Json(is_online))
}

#[get("/user/{email}")]
pub async fn user_by_email_handler(
    params: Path<String>,
    minimal_users_coll: Data<Collection<MinimalUser>>,
    user: User,
) -> Result<impl Responder, Error> {
    let email = params.into_inner();
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
        .map_err(|_| ErrorInternalServerError(""))?;

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
        .map_err(|_| ErrorInternalServerError(""))?
        .try_collect().await
        .map_err(|_| ErrorInternalServerError(""))?;

    Ok(Json(users))
}

#[post("/request/{id}")]
pub async fn request_id_handler(
    params: Path<String>,
    users_coll: Data<Collection<User>>,
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = params.into_inner();
    let id = ObjectId::from_str(&id)
        .map_err(|_| ErrorBadRequest("Not an id"))?;

    if user._id == id {
        return Err(ErrorBadRequest("Make peace with yourself"))
    }

    let filter = doc! {
        "deleted": false,
        "confirmed": true,
        "_id": id
    };
    let req_user = users_coll.find_one(filter, None).await
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorBadRequest("User not found"))?;

    if req_user.friends.contains(&user._id) {
        return Err(ErrorBadRequest("Already friend"))
    }

    let filter = doc!{"_id": &req_user._id};
    let update = doc!{"$addToSet": {"requests": user._id}};
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;
   
    tokio::spawn(async move {
        let event = Dispatch {
            event: "request".to_string(),
            payload: doc!{
                "_id": user._id.to_hex(),
                "username": &user.username,
                "email": &user.email,
                "avatar": &user.avatar,
            },
            filter: vec![req_user._id]
        };
        ws_addr.send(event).await.ok();

        let title = format!("'{}' sent you a friend request!", user.username);
        let body = user.email;
        utils::send_push_notifications(&users_coll, req_user._id, req_user.devices, title, body).await;
    });
        
    Ok("")
}

#[get("/request")]
pub async fn request_handler(
    minimal_users_coll: Data<Collection<MinimalUser>>,
    user: User,
) -> Result<impl Responder, Error> {
    let filter = doc! {
        "deleted": false,
        "confirmed": true,
        "_id": {"$in": user.requests}
    };


    let req_users: Vec<MinimalUser> = minimal_users_coll.find(filter, None).await
        .map_err(|_| ErrorInternalServerError(""))?
        .try_collect().await
        .map_err(|_| ErrorInternalServerError(""))?;

    Ok(Json(req_users))
}

#[post("/accept/{id}")]
pub async fn accept_id_handler(
    params: Path<String>,
    users_coll: Data<Collection<User>>,
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = params.into_inner();
    let id = ObjectId::from_str(&id)
        .map_err(|_| ErrorBadRequest("Not an id"))?;

    if !user.requests.iter().any(|r| r == &id) {
        return Err(ErrorBadRequest("Not in requests"));
    }

    let filter = doc! {"_id": user._id};
    let update = doc! {
        "$pull": {"requests": id},
        "$addToSet": {"friends": id}
    };
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;

    let filter = doc! {"_id": id};
    let update = doc! {"$addToSet": {"friends": user._id}};
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;
        
    tokio::spawn(async move {
        let event = Dispatch {
            event: "friend".to_string(),
            payload: doc!{
                "_id": user._id.to_hex(),
                "username": &user.username,
                "email": &user.email,
                "avatar": &user.avatar,
            },
            filter: vec![id]
        };
        
        ws_addr.send(event).await.ok();

        let filter = doc! {"_id": id};
        if let Ok(Some(requester)) = users_coll.find_one(filter, None).await {
            let title = "New friend!".to_string();
            let body = format!("{} accepted your friend request!", &user.username);
            utils::send_push_notifications(&users_coll, requester._id, requester.devices, title, body).await;
        }
    });

    Ok("")
}

#[post("/decline/{id}")]
pub async fn decline_id_handler(
    params: Path<String>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    let id = params.into_inner();
    let id = ObjectId::from_str(&id)
        .map_err(|_| ErrorBadRequest("Not an id"))?;

    if !user.requests.iter().any(|r| r == &id) {
        return Err(ErrorBadRequest("Not in requests"));
    }

    let filter = doc! {"_id": user._id};
    let update = doc! {"$pull": {"requests": id}};
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;

    Ok("")
}

#[post("/addDevice")]
pub async fn add_device_handler(
    device: Json<Device>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    if user.devices.iter().any(|d| d.name == device.name) {
        return Err(ErrorBadRequest("Name collision"))
    }

    let filter = doc!{"_id": &user._id};
    let update = doc!{"$push": {"devices": &*device}};
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;

    tokio::spawn(async move {
        let title = "Device registered!".to_string();
        let body = format!("Device '{}' is ready to be used.", device.name);
        utils::send_push_notifications(&users_coll, user._id, vec![(*device).clone()], title, body).await;
    });

    Ok("")
}

#[delete("/removeDevice/{name}")]
pub async fn remove_device_handler(
    params: Path<String>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    let name = params.into_inner();

    let device = user.devices.iter().find(|d| d.name == name)
        .ok_or_else(|| ErrorBadRequest("No such device"))?;

    let filter = doc!{"_id": &user._id};
    let update = doc!{"$pull": {"devices": &device}};
    users_coll.update_one(filter, update, None).await
        .map_err(|_| ErrorInternalServerError(""))?;

    Ok("")
}

#[post("/testDevices")]
pub async fn test_devices_handler(
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    let title = "Test notification!".to_string();
    let body = "This device is set up properly 🚀".to_string();
    utils::send_push_notifications(&users_coll, user._id, user.devices, title, body).await;
    
    let filter = doc!{"_id": user._id};
    let remaining_devices = users_coll.find_one(filter, None).await
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorInternalServerError(""))?
        .devices;

    Ok(Json(remaining_devices))
}

#[post("/ping")]
pub async fn ping_handler(
    ping: Json<PingBody>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    if !user.friends.contains(&ping.id) {
        return Err(ErrorBadRequest("Not friend"))
    }

    let filter = doc!{"_id": ping.id};
    let friend_devices = users_coll.find_one(filter, None).await
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorInternalServerError(""))?
        .devices;
   
    let title = format!("'{}' pinged you!", user.username);
    let body = if !ping.message.is_empty() {
        ping.message.graphemes(true).take(50).collect()
    } else {
        format!("'{}' needs you online.", user.username)
    };

    let success = utils::send_push_notifications(&users_coll, ping.id, friend_devices, title, body).await;
    Ok(Json(success))
}

#[get("/changelog/{version}")]
pub async fn changelog_version_handler(
    params: Path<String>,
    changelog: Data<SerdeMap<String, SerdeValue>>,
    _user: User,
) -> Result<impl Responder, Error> {
    let version = params.into_inner();

    if changelog.get(&version).is_none() {
        return Err(ErrorBadRequest("No such version"));
    }

    let changes = changelog.iter()
        .take_while(|(v, _)| v != &&version)
        .map(|(version, changelog)| (version.clone(), changelog.clone()))
        .collect::<SerdeMap::<String, SerdeValue>>();

    Ok(Json(changes))
}

#[get("/changelog")]
pub async fn changelog_handler(
    changelog: Data<SerdeMap<String, SerdeValue>>,
    _user: User,
) -> Result<impl Responder, Error> {
    let res = (**changelog).clone();

    Ok(Json(res))
}

#[get("/breaking/{version}")]
pub async fn breaking_version_handler(
    params: Path<String>,
    changelog: Data<SerdeMap<String, SerdeValue>>,
    _user: User,
) -> Result<impl Responder, Error> {
    let version = params.into_inner();

    let log_for_version = changelog.get(&version);
    if log_for_version.is_none() {
        return Err(ErrorBadRequest("No such version"));
    }

    let new_versions = changelog.keys()
        .take_while(|v| v != &&version)
        .any(|v| changelog[v]["type"] == "breaking");

    Ok(Json(new_versions))
}

#[post("/feedback")]
pub async fn feedback_handler(
    db: Data<Database>,
    feedback: Json<Feedback>,
    _user: User,
) -> Result<impl Responder, Error> {
    db.collection::<Feedback>("feedbacks").insert_one(&*feedback, None).await
        .map_err(|_| ErrorInternalServerError(""))?;

    Ok("")
}

#[post("/log")]
pub async fn log_handler(
    ws_addr: Data<Addr<Server>>,
    user: User,
) -> Result<impl Responder, Error> {
    if !user.admin {
        return Err(ErrorForbidden("You are not an admin!"));
    }

    let onlines = ws_addr.send(ConnectedIds).await
        .map_err(|_| ErrorInternalServerError(""))?
        .ok_or_else(|| ErrorInternalServerError(""))?;
    
    let onlines: Vec<String> = onlines.iter().map(|id| id.to_hex()).collect();

    println!("{:?}", onlines);

    Ok("")
}

#[get("/static/{file}")]
pub async fn files_handler(
    params: Path<String>,
    curr_dir : Data<CurrDir>,
    _user: User,
) -> Result<impl Responder, Error> {
    let file = params.into_inner();
    let path = PathBuf::from(format!("{}/files/{}", curr_dir.path, file));
    
    let res = NamedFile::open(path)
        .map_err(|_| ErrorNotFound(file))?;
    
    Ok(res)
}