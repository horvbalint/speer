use mongodb::bson;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WebPushSubscriptionKeys {
    pub auth: String,
    pub p256dh: String
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebPushSubscription {
    pub endpoint: String,
    pub expiration_time: Option<String>,
    pub keys: WebPushSubscriptionKeys
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Device {
    pub name: String,
    pub subscription: WebPushSubscription,
}

impl Into<bson::Bson> for Device {
    fn into(self) -> bson::Bson {
        bson::to_bson(&self).unwrap()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MinimalDevice {
    pub name: String,
}
