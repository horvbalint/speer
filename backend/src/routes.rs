use actix_web::{HttpResponse, Responder, error::*, get, http::StatusCode, post, web::{Path, Json, Data}, cookie::Cookie};
use futures::StreamExt;
use mongodb::{Collection, Database, bson::doc, options::{FindOneOptions, FindOptions}};
use serde::Deserialize;
use jsonwebtoken::{encode, Header, EncodingKey};
use std::{fs::remove_file, time::{SystemTime, UNIX_EPOCH}};
use std::path::PathBuf;
use actix_files::NamedFile;
use image::imageops::FilterType;
use crate::CurrDir;
use std::env;

use crate::schemas::User;
use crate::schemas::Confirm;
use crate::jwt::JWT;

extern crate bcrypt;
use bcrypt::verify;

extern crate image;

#[derive(Deserialize)]
pub struct LoginCredentials {
    email: String,
    password: String
}

#[post("/login")]
pub async fn login_handler(
    credentials: Json<LoginCredentials>,
    users_coll: Data<Collection<User>>
) -> Result<impl Responder, Error> {
    let filter = doc! {"email": &credentials.email};

    let user = users_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("User does not exist")))?
        .ok_or(ErrorInternalServerError(""))?;

    let verify = verify(&credentials.password, user.password.as_str())
        .or(Err(ErrorUnauthorized("Password does not match")))?;

    if !verify {
        return Err(ErrorUnauthorized("Password does not match"))
    }

    let current_utc = SystemTime::now().duration_since(UNIX_EPOCH).expect("Time went backwards").as_secs();
    let token_claims = JWT::new(user._id, current_utc + (24 * 60 * 60));
    let token = encode(&Header::default(), &token_claims, &EncodingKey::from_secret("secret".as_ref()))
        .or(Err(ErrorInternalServerError("")))?;

    let cookie = Cookie::build("speer", token)
        // .domain("www.rust-lang.org")
        // .path("/")
        // .secure(true)
        .http_only(true)
        .finish();

    Ok(
        HttpResponse::build(StatusCode::OK)
        .cookie(cookie)
        .body("Logged in")
    )
}

#[post("/logout")]
pub async fn logout_handler() -> Result<impl Responder, Error> {
    let cookie = Cookie::build("speer", "logged_out")
        // .domain("www.rust-lang.org")
        // .path("/")
        // .secure(true)
        .http_only(true)
        .finish();

    Ok(
        HttpResponse::build(StatusCode::OK)
        .cookie(cookie)
        .body("Logged out")
    )
}

#[post("/confirm/{token}")]
pub async fn confirm_handler(
    Path(token): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    uesers_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let filter = doc! {"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("Invalid token")))?
        .ok_or(ErrorInternalServerError("Invalid token"))?;

    let filter = doc! {"_id": confirm.user};
    let update = doc! {"$set": {"confirmed": true}};
    uesers_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("")))?;

    let filter = doc! {"_id": confirm._id};
    confirms_coll.delete_one(filter, None).await.ok();

    Ok("ok")
}

#[post("/cancel/{token}")]
pub async fn cancel_handler(
    Path(token): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let filter = doc! {"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(ErrorInternalServerError("Invalid token")))?
        .ok_or(ErrorInternalServerError("Invalid token"))?;

    let filter = doc! {"_id": confirm.user, "confirmed": false};
    users_coll.delete_one(filter, None).await
        .or(Err(ErrorInternalServerError("Failed to cancel token")))?;

    let filter = doc! {"_id": confirm._id};
    confirms_coll.delete_one(filter, None).await.ok();

    Ok("ok")
}

#[post("/resendConfirmation/{email}")]
pub async fn resend_confirmation_handler(
    Path(email): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, Error> {
    let filter = doc! {"email": email, "confirmed": false, "deleted": false};
    let user = users_coll.find_one(filter, None).await
        .or(Err(ErrorBadRequest("Invalid email")))?
        .ok_or(ErrorBadRequest("Invalid email"))?;
    
    let filter = doc! {"user": user._id};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(ErrorBadRequest("Failed to resend email")))?
        .ok_or(ErrorBadRequest("Failed to resend email"))?;

    // TODO: Send mail

    Ok("ok")
}

#[post("/avatar")]
pub async fn avatar_handler(
    mut parts: awmp::Parts,
    users_coll: Data<Collection<User>>,
    user: User,
    curr_dir : Data<CurrDir>,
) -> Result<impl Responder, Error> {
    let files_path = format!("{}/files", curr_dir.path);

    let uploaded_file = parts.files.take("avatar").pop()
        .ok_or(ErrorBadRequest("No avatar provided"))?;

    let extension = uploaded_file.original_file_name().and_then(|name| {name.split('.').next_back()}).unwrap_or("avatar");
    let file_name = crate::utils::generate_random_string(32);
    let full_file_name = format!("{}.{}", file_name, extension);

    let path = PathBuf::from(format!("{}/{}", files_path, full_file_name));

    let save_res = uploaded_file.persist_in("/tmp")
        .or(Err(ErrorInternalServerError("Failed to save image")))?;

    let tmp_path = save_res.display().to_string();
    
    image::open(&tmp_path)
        .and_then(|img| {
            let tmp = img.resize_to_fill(200, 200, FilterType::Triangle);
            tmp.save(path)
        })
        .or(Err(ErrorInternalServerError("")))?;

    let filter = doc! {"_id": user._id};
    let update = doc! {"$set": {"avatar": &full_file_name}};
    users_coll.update_one(filter, update, None).await
        .or(Err(ErrorInternalServerError("Could not update user profile")))?;
        
    remove_file(tmp_path).ok();
    if user.avatar != "avatar.jpg" {
        let path = PathBuf::from(format!("{}/{}", files_path, user.avatar));
        remove_file(path).ok();
    }

    Ok(full_file_name)
}

#[get("/user/{email}")]
pub async fn user_by_email_handler(
    Path(email): Path<String>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, Error> {
    let options = FindOneOptions::builder()
        .projection(doc! {
            "username": 1,
            "email": 1,
            "avatar": 1
        })
        .build();

    let filter = doc! {
        "email": &email,
        "deleted": false,
        "confirmed": true,
        "$and": [
            doc!{"_id": doc!{"$nin": user.friends }},
            doc!{"_id": doc!{"$ne": user._id}},
        ]
    };

    let user = users_coll.find_one(filter, options).await
        .or(Err(ErrorInternalServerError("")))?
        .ok_or(ErrorBadRequest(format!("No user found with email: {}", email)))?;

    Ok(Json(user))
}

#[get("/me")]
pub async fn me_handler(
    db: Data<Database>,
    user: User,
) -> Result<impl Responder, Error> {
    let options = FindOneOptions::builder()
        .projection(doc! {
            "password": 0,
            "admin": 0,
        })
        .build();

    let filter = doc! {"_id": user._id};

    let user = db.collection("users").find_one(filter, options).await
        .or(Err(ErrorInternalServerError("")))?
        .ok_or(ErrorBadRequest(""))?;

    Ok(Json(user))
}

#[get("/friends")]
pub async fn friends_handler(
    db: Data<Database>,
    user: User,
) -> Result<impl Responder, Error> {
    dbg!(&user.friends);
    let filter = doc! {"deleted": false, "confirmed": true, "_id": {"$in": user.friends}};
    let options = FindOptions::builder()
        .projection(doc! {
            "username": 1,
            "email": 1,
            "avatar": 1,
        })
        .build();

    let mut result = db.collection("users").find(filter, options).await
        .or(Err(ErrorInternalServerError("")))?;

    let mut users = vec![];
    while let Some(Ok(doc)) = result.next().await {
        users.push(doc);
    }

    Ok(Json(users))
}

#[get("/static/{file}")]
pub async fn files_handler(
    Path(file): Path<String>,
    _user: User,
) -> Result<impl Responder, Error> {
    let mut path = env::current_dir()?;
    path.push(PathBuf::from(format!("files/{}", file)));
    
    let res = NamedFile::open(path)
        .or(Err(ErrorNotFound(file)))?;
    
    Ok(res)
}