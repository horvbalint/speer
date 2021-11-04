use mongodb::bson::oid::ObjectId;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct JWT {
    pub id: String,
    pub exp: usize,
}

impl JWT {
    pub fn new(id: ObjectId, exp: u64) -> Self {
        JWT {
            id: id.to_string(),
            exp: exp as usize
        }
    }
}