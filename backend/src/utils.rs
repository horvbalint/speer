use futures::future;
use log::error;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Collection,
};
use rand::{distributions::Alphanumeric, Rng};
use serde_json::json;
use std::fs::File;
use web_push::*;

use crate::schemas::{Device, User};

pub fn generate_random_string(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect::<String>()
        .to_lowercase()
}

pub fn get_file_extension(file: &awmp::File, fallback_str: &str) -> String {
    return file
        .original_file_name()
        .and_then(|name| name.split('.').next_back())
        .unwrap_or(fallback_str)
        .to_string();
}

pub async fn send_push_notifications(
    users_coll: &Collection<User>,
    user_id: ObjectId,
    devices: Vec<Device>,
    title: String,
    body: String,
) -> bool {
    let futures = devices
        .iter()
        .map(|device| send_push_notification(device.clone(), title.clone(), body.clone()));
    let results = future::join_all(futures).await;

    let devices_len = devices.len();
    let expired_devices: Vec<_> = results
        .iter()
        .zip(devices)
        .filter(|(result, _)| result.is_err())
        .map(|(_, device)| device.name)
        .collect();

    if !expired_devices.is_empty() {
        let expired_devices_clone = expired_devices.clone();
        let users_coll_clone = users_coll.clone();

        tokio::spawn(async move {
            let filter = doc! {"_id": user_id};
            let update = doc! {"$pull": {"devices": {"name": {"$in": expired_devices_clone}}}};

            users_coll_clone.update_one(filter, update, None).await.ok();
        });
    }

    expired_devices.len() < devices_len
}

async fn send_push_notification(
    device: Device,
    title: String,
    body: String,
) -> Result<(), WebPushError> {
    let file = File::open("vapid.pem")
        .log_and_map(WebPushError::Unspecified)?;

    let subscription_info = SubscriptionInfo::new(
        &device.subscription.endpoint,
        &device.subscription.keys.p256dh,
        &device.subscription.keys.auth,
    );

    let sig_builder = VapidSignatureBuilder::from_pem(file, &subscription_info)?.build()?;

    let content = json!({"title": title, "body": body}).to_string();
    let content = content.as_bytes();

    let mut message_builder = WebPushMessageBuilder::new(&subscription_info);
    message_builder.set_payload(ContentEncoding::Aes128Gcm, content);
    message_builder.set_vapid_signature(sig_builder);

    let message = message_builder.build()?;
    let client = IsahcWebPushClient::new()?;

    client.send(message).await
}

pub trait MapAndLog<T> {
    fn log_and_map<NewError: std::fmt::Debug>(self, error: NewError) -> Result<T, NewError>;
}

impl<T, OriginalError: Sized + std::fmt::Debug> MapAndLog<T> for Result<T, OriginalError> {
    fn log_and_map<NewError: std::fmt::Debug>(self, error: NewError) -> Result<T, NewError> {
        match self {
            Ok(res) => Ok(res),
            Err(err) => {
                error!("{error:#?}\n{err:#?}");

                Err(error)
            }
        }
    }
}
