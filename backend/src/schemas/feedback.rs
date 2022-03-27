use serde::{Serialize, Deserialize};
use mongodb::bson::datetime::DateTime;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feedback {
    pub description: String,
    pub steps_to_reproduce: Vec<String>,
    pub r#type: String,
    pub version: String,
    #[serde(default = "DateTime::now")]
    pub date: DateTime,
}