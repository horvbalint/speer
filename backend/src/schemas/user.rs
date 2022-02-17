use std::pin::Pin;
use actix_web::{Error, FromRequest, HttpMessage, HttpRequest, cookie::Cookie, dev, error::ErrorUnauthorized, web::Data};
use futures::{Future};
use mongodb::{Collection, Database, bson::{doc, oid::ObjectId}};
use serde::{Serialize, Deserialize};
use jsonwebtoken::{decode, Validation, DecodingKey};

use crate::{jwt::JWT, EnvVars};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Device {
    pub name: String,
    pub endpoint: String,
    pub subscription: String,
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub _id: ObjectId,
    pub email: String,
    pub password: String,
    pub username: String,
    pub avatar: String,
    pub requests: Vec<ObjectId>,
    pub friends: Vec<ObjectId>,
    pub devices: Vec<Device>,
    pub confirmed: bool,
    pub deleted: bool,
    pub admin: bool,
}

impl FromRequest for User {
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;
    type Config = ();

    fn from_request(req: &HttpRequest, _: &mut dev::Payload) -> Self::Future {
        let env_vars = req.app_data::<Data<EnvVars>>().unwrap();
        let cookie_secret = env_vars.cookie_secret.clone();
        let cookie = req.cookie("speer");
        let db = req.app_data::<Data<Database>>().unwrap().clone();

        Box::pin(async move {
            let collection = db.collection::<User>("users"); 
            process_req_auth_data(collection, cookie, cookie_secret).await
        })
    }
}

impl Default for User {
    fn default() -> Self {
        User {
            _id: ObjectId::new(),
            email: "".to_string(),
            password: "".to_string(),
            username: "".to_string(),
            avatar: "avatar.jpg".to_string(),
            requests: vec![],
            friends: vec![],
            devices: vec![],
            confirmed: false,
            deleted: false,
            admin: false,
        }
    }
}

async fn process_req_auth_data(collection: Collection<User>, cookie: Option<Cookie<'_>>, cookie_secret: String) -> Result<User, Error> {
    let cookie = cookie
        .ok_or(ErrorUnauthorized("You are not logged in"))?;

    let decoded_token = decode::<JWT>(&cookie.value(), &DecodingKey::from_secret(cookie_secret.as_ref()), &Validation::default())
        .or(Err(ErrorUnauthorized("Token invalid")))?;

    let id = ObjectId::parse_str(decoded_token.claims.id.as_str())
        .or(Err(ErrorUnauthorized("You are not logged in")))?;

    collection.find_one(doc! {"_id": id}, None).await
        .or(Err(ErrorUnauthorized("You are not logged in")))?
        .ok_or(ErrorUnauthorized("You are not logged in"))
}
