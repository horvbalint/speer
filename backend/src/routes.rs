use actix_web::{HttpResponse, Responder, error, get, http::StatusCode, post, web::{Path, Json, Data}, cookie::Cookie};
use futures::StreamExt;
use mongodb::{Collection, Database, bson::doc, options::{FindOneOptions, FindOptions}};
use serde::Deserialize;
use jsonwebtoken::{encode, Header, EncodingKey};
use std::time::{SystemTime, UNIX_EPOCH};
use std::path::PathBuf;
use actix_files::NamedFile;
use std::env;

use crate::schemas::User;
use crate::schemas::Confirm;
use crate::jwt::JWT;

extern crate bcrypt;
use bcrypt::verify;

#[derive(Deserialize)]
pub struct LoginCredentials {
    email: String,
    password: String
}

#[post("/login")]
pub async fn login_handler(
    credentials: Json<LoginCredentials>,
    users_coll: Data<Collection<User>>
) -> Result<impl Responder, error::Error> {
    let filter = doc! {"email": &credentials.email};

    let user = users_coll.find_one(filter, None).await
        .or(Err(error::ErrorInternalServerError("User does not exist")))?
        .ok_or(error::ErrorInternalServerError(""))?;

    let verify = verify(&credentials.password, user.password.as_str())
        .or(Err(error::ErrorUnauthorized("Password does not match")))?;

    if !verify {
        return Err(error::ErrorUnauthorized("Password does not match"))
    }

    let current_utc = SystemTime::now().duration_since(UNIX_EPOCH).expect("Time went backwards").as_secs();
    let token_claims = JWT::new(user._id, current_utc + (24 * 60 * 60));
    let token = encode(&Header::default(), &token_claims, &EncodingKey::from_secret("secret".as_ref()))
        .or(Err(error::ErrorInternalServerError("")))?;

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
pub async fn logout_handler() -> Result<impl Responder, error::Error> {
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
) -> Result<impl Responder, error::Error> {
    let filter = doc! {"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(error::ErrorInternalServerError("Invalid token")))?
        .ok_or(error::ErrorInternalServerError("Invalid token"))?;

    let filter = doc! {"_id": confirm.user};
    let update = doc! {"confirmed": true};
    uesers_coll.update_one(filter, update, None).await
        .or(Err(error::ErrorInternalServerError("")))?;

    let filter = doc! {"_id": confirm._id};
    confirms_coll.delete_one(filter, None).await.ok();

    Ok("ok")
}

#[post("/cancel/{token}")]
pub async fn cancel_handler(
    Path(token): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, error::Error> {
    let filter = doc! {"token": token};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(error::ErrorInternalServerError("Invalid token")))?
        .ok_or(error::ErrorInternalServerError("Invalid token"))?;

    let filter = doc! {"_id": confirm.user, "confirmed": false};
    users_coll.delete_one(filter, None).await
        .or(Err(error::ErrorInternalServerError("Failed to cancel token")))?;

    let filter = doc! {"_id": confirm._id};
    confirms_coll.delete_one(filter, None).await.ok();

    Ok("ok")
}

#[post("/resendConfirmation/{email}")]
pub async fn resend_confirmation_handler(
    Path(email): Path<String>,
    confirms_coll: Data<Collection<Confirm>>,
    users_coll: Data<Collection<User>>,
) -> Result<impl Responder, error::Error> {
    let filter = doc! {"email": email, "confirmed": false, "deleted": false};
    let user = users_coll.find_one(filter, None).await
        .or(Err(error::ErrorBadRequest("Invalid email")))?
        .ok_or(error::ErrorBadRequest("Invalid email"))?;
    
    let filter = doc! {"user": user._id};
    let confirm = confirms_coll.find_one(filter, None).await
        .or(Err(error::ErrorBadRequest("Failed to resend email")))?
        .ok_or(error::ErrorBadRequest("Failed to resend email"))?;

    // TODO: Send mail

    Ok("ok")
}

#[get("/user/{email}")]
pub async fn user_by_email_handler(
    Path(email): Path<String>,
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, error::Error> {
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
        .or(Err(error::ErrorInternalServerError("")))?
        .ok_or(error::ErrorBadRequest(format!("No user found with email: {}", email)))?;

    Ok(Json(user))
}

#[get("/me")]
pub async fn me_handler(
    db: Data<Database>,
    user: User,
) -> Result<impl Responder, error::Error> {
    let options = FindOneOptions::builder()
        .projection(doc! {
            "password": 0,
            "admin": 0,
        })
        .build();

    let filter = doc! {"_id": user._id};

    let user = db.collection("users").find_one(filter, options).await
        .or(Err(error::ErrorInternalServerError("")))?
        .ok_or(error::ErrorBadRequest(""))?;

    Ok(Json(user))
}

#[get("/friends")]
pub async fn friends_handler(
    users_coll: Data<Collection<User>>,
    user: User,
) -> Result<impl Responder, error::Error> {
    let options = FindOptions::builder()
        .projection(doc! {
            "username": 1,
            "email": 1,
            "avatar": 1,
        })
        .build();

    let filter = doc! {"deleted": false, "confirmed": true, "_id": doc!{"$in": user.friends}};

    let mut result = users_coll.find(filter, options).await
        .or(Err(error::ErrorInternalServerError("")))?;

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
) -> Result<impl Responder, error::Error> {
    let mut path = env::current_dir()?;
    path.push(PathBuf::from(format!("files/{}", file)));
    
    let res = NamedFile::open(path)
        .or(Err(error::ErrorNotFound(file)))?;
    
    Ok(res)
}