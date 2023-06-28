use serde::{Serialize, Deserialize};
use mongodb::bson::datetime::DateTime;
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Feedback {
    pub description: String,
    pub steps_to_reproduce: Vec<String>,
    pub r#type: String,
    pub version: String,
    #[serde(default = "DateTime::now")]
    pub date: DateTime,
}
