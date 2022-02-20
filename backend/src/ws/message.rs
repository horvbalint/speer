use actix::{prelude::Message, Addr};
use mongodb::bson::{Document, oid::ObjectId};
use crate::schemas::User;
use super::Connection;

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Connect {
    pub addr: Addr<Connection>,
    pub user: User,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Disconnect {
  pub _id: ObjectId,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Subscribe {
  pub _id: ObjectId,
  pub event: String,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Unsubscribe {
  pub _id: ObjectId,
  pub event: String,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Signal {
  pub _id: ObjectId,
  pub action: String,
  pub peer_data: String,
  pub remote_id: ObjectId,
  pub r#type: String,
  pub data: Option<String>,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Send(pub String);

#[derive(Message, Debug)]
#[rtype(result = "Option<Vec<ObjectId>>")]
pub struct ConnectedIds;

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Dispatch {
  pub event: String,
  pub payload: Document,
  pub filter: Vec<ObjectId>,
}