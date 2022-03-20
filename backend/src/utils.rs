use futures::future;
use mongodb::{bson::{oid::ObjectId, doc}, Collection};
use rand::{distributions::Alphanumeric, Rng};
use serde_json::json;
use web_push::*;
use std::fs::File;

use crate::schemas::{Device, User};

pub fn generate_random_string(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect::<String>()
        .to_lowercase()
}

pub async fn send_push_notifications(users_coll: &Collection<User>, user_id: ObjectId, devices: Vec<Device>, title: String, body: String) -> bool {
    let futures = devices.iter().map(|device| send_push_notification(device.clone(), title.clone(), body.clone()));
    let results = future::join_all(futures.into_iter().map(tokio::spawn)).await;

    let devices_len = devices.len();
    let mut expired_devices = vec![];

    for (result, device) in results.iter().zip(devices) {
        match result {
            Ok(res) => {
                if res.is_err() {
                    expired_devices.push(device.name)
                }
            },
            Err(_) => expired_devices.push(device.name)
        }
    }

    if expired_devices.len() > 0 {
        let filter = doc!{"_id": user_id};
        let update = doc!{"$pull": {"devices": {"name": {"$in": &expired_devices}}}};
    
        users_coll.update_one(filter, update, None).await.ok();
    }

    expired_devices.len() < devices_len
}

async fn send_push_notification(device: Device, title: String, body: String) -> Result<(), WebPushError> {
    if let Ok(file) = File::open("vapid.pem") {
        let subscription_info = SubscriptionInfo::new(
            &device.subscription.endpoint,
            &device.subscription.keys.p256dh,
            &device.subscription.keys.auth
        );
    
        let sig_builder = VapidSignatureBuilder::from_pem(file, &subscription_info)?.build()?;
    
        let content = json!({"title": title, "body": body}).to_string();
        let content = content.as_bytes();
        
        let mut message_builder = WebPushMessageBuilder::new(&subscription_info)?;
        message_builder.set_payload(ContentEncoding::Aes128Gcm, content);
        message_builder.set_vapid_signature(sig_builder);
        
        let message = message_builder.build()?;
        let client = WebPushClient::new()?;
    
        client.send(message).await
    }
    else {
        Err(WebPushError::Unspecified)
    }
}