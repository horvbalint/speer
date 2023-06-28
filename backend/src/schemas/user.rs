use std::pin::Pin;
use actix_web::{Error, FromRequest, HttpRequest, dev, error::{ErrorUnauthorized, ErrorInternalServerError}, web::Data};
use futures::{Future};
use mongodb::{Collection, Database, bson::{doc, oid::ObjectId, serde_helpers::serialize_object_id_as_hex_string}};
use actix_identity::Identity;
use serde::{Serialize, Deserialize};
use ts_rs::TS;

use crate::schemas::{Device, MinimalDevice};

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

    fn from_request(req: &HttpRequest, _: &mut dev::Payload) -> Self::Future {
        let db = req.app_data::<Data<Database>>().unwrap();
        let collection = db.collection::<User>("users");
        let identity = Identity::extract(req).into_inner();

        Box::pin(async move {
          process_req_auth_data(collection, identity).await
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

async fn process_req_auth_data(collection: Collection<User>, identity: Result<Identity, Error>) -> Result<User, Error> {
    let id = identity
      .map_err(|_| ErrorUnauthorized("You are not logged in"))?
      .id()
      .map_err(|_| ErrorUnauthorized("You are not logged in"))?;

    let id = ObjectId::parse_str(&id)
      .map_err(|_| ErrorInternalServerError(""))?;

    let user = collection.find_one(doc! {"_id": id}, None).await
        .map_err(|_| ErrorUnauthorized("You are not logged in"))?
        .ok_or_else(|| ErrorUnauthorized("You are not logged in"))?;

    if user.deleted { return Err(ErrorUnauthorized("User deactivated")) }

    Ok(user)
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct MinimalUser {
    #[serde(serialize_with = "serialize_object_id_as_hex_string")]
    pub _id: ObjectId,
    pub email: String,
    pub username: String,
    pub avatar: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct MeUser {
    #[serde(serialize_with = "serialize_object_id_as_hex_string")]
    pub _id: ObjectId,
    pub email: String,
    pub username: String,
    pub avatar: String,
    pub requests: Vec<ObjectId>,
    pub friends: Vec<ObjectId>,
    pub devices: Vec<MinimalDevice>,
    pub confirmed: bool,
    pub deleted: bool,
}
