use actix::{prelude::Message, Addr};

use crate::schemas::User;

use super::Connection;

#[derive(Message, Debug)]
#[rtype(result = "()")]
pub struct Send(pub String);

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