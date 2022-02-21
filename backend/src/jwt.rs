use mongodb::bson::oid::ObjectId;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Jwt {
    pub id: String,
    pub exp: usize,
}

impl Jwt {
    pub fn new(id: ObjectId, exp: u64) -> Self {
        Jwt {
            id: id.to_string(),
            exp: exp as usize
        }
    }
}