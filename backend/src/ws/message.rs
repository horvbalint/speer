use actix::{prelude::Message, Addr};
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
  pub _id: String,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Subscribe {
  pub _id: String,
  pub event: String,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Unsubscribe {
  pub _id: String,
  pub event: String,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Signal {
  pub _id: String,
  pub action: String,
  pub peer_data: String,
  pub remote_id: String,
  pub r#type: String,
  pub data: Option<String>,
}

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Send(pub String);

#[derive(Message, Debug)]
#[rtype(result = "Option<Vec<String>>")]
pub struct ConnectedIds;

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Dispatch {
  pub event: String,
  pub payload: String,
  pub filter: Vec<String>,
}