use actix_web::{HttpResponse, Responder, error, get, http::StatusCode, post, web::{Path, Json, Data, Bytes}, cookie::Cookie};
use futures::StreamExt;
use mongodb::{
    bson::{doc, document::Document, oid::ObjectId},
    options::{FindOneOptions, FindOptions},
    Database,
    Collection
};
use serde::Deserialize;
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use std::time::{SystemTime, UNIX_EPOCH};
use std::path::PathBuf;
use actix_files::NamedFile;
use std::env;

use crate::schemas::User;
use crate::jwt::JWT;

extern crate bcrypt;
use bcrypt::{hash, verify};

#[derive(Deserialize)]
pub struct LoginCredentials {
    email: String,
    password: String
}

#[post("/login")]
pub async fn login(
    credentials: Json<LoginCredentials>,
    db: Data<Database>
) -> Result<impl Responder, error::Error> {
    let filter = doc! {"email": &credentials.email};

    let user = db.collection_with_type::<User>("users").find_one(filter, None).await
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
        .body("All good")
    )
}

#[get("/user/{email}")]
pub async fn user_by_email(
    Path(email): Path<String>,
    db: Data<Database>,
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

    let result = db.collection("users").find_one(filter, options).await
        .or(Err(error::ErrorInternalServerError("")))?;

    let user = result
        .ok_or(error::ErrorBadRequest(format!("No user found with email: {}", email)))?;

    Ok(Json(user))
}

#[get("/me")]
pub async fn me(
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

    let result = db.collection("users").find_one(filter, options).await
        .or(Err(error::ErrorInternalServerError("")))?;

    let user = result
        .ok_or(error::ErrorBadRequest(""))?;

    Ok(Json(user))
}

#[get("/friends")]
pub async fn friends(
    db: Data<Database>,
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

    let mut result = db.collection("users").find(filter, options).await
        .or(Err(error::ErrorInternalServerError("")))?;

    let mut users = vec![];
    while let Some(Ok(doc)) = result.next().await {
        users.push(doc);
    }

    Ok(Json(users))
}

#[get("/static/{file}")]
pub async fn files(
    Path(file): Path<String>,
    _user: User,
) -> Result<impl Responder, error::Error> {
    let mut path = env::current_dir()?;
    path.push(PathBuf::from(format!("files/{}", file)));
    
    let res = NamedFile::open(path)
        .or(Err(error::ErrorNotFound(file)))?;
    
    Ok(res)
}