use mongodb::bson::oid::ObjectId;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Confirm {
    pub _id: ObjectId,
    pub user: ObjectId,
    pub token: String,
}