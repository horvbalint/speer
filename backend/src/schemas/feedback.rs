use serde::{Serialize, Deserialize};
use mongodb::bson::datetime::DateTime;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feedback {
    description: String,
    steps_to_reproduce: Vec<String>,
    r#type: String,
    version: String,
    #[serde(default = "DateTime::now")]
    date: DateTime,
}