use crate::schemas::User;
use super::{Send, Connect, Disconnect, Connection};
use actix::{prelude::{Actor, Context, Handler}, Addr};
use std::collections::{HashMap};

#[derive(Debug)]
pub struct Server {
    connections: HashMap<String, (User, Addr<Connection>)>,          //self id to self
}

impl Actor for Server {
    type Context = Context<Self>;
}

impl Server {
    pub fn new() -> Server {
        Server {connections: HashMap::new()}
    }

    fn send_message(&self, id: String, message: &str) {
        if let Some(connection) = self.connections.get(&id) {
            connection.1.do_send(Send(message.to_owned()));
        } else {
            println!("Failed to send message \"{}\" to {}. Id not found.", message, id);
        }
    }
}

impl Handler<Disconnect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        if let Some(user) = self.connections.remove(&msg._id) {
            let user = &user.0;

            for friend in user.friends.iter() {
                self.send_message(friend.to_string(), format!("{{\"event\": \"logout\", \"data\": \"{}\"}}", user._id).as_str())
            }
        }
    }
}


impl Handler<Connect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) {
        println!("Before: {:?}", self.connections);
        for friend in msg.user.friends.iter() {
            self.send_message(friend.to_string(), format!("{{\"event\": \"login\", \"data\": \"{}\"}}", msg.user._id).as_str())
        }

        self.connections.insert(msg.user._id.to_string(), (msg.user, msg.addr));
        println!("After: {:?}", self.connections);
    }
}