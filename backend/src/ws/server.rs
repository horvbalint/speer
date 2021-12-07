use crate::schemas::User;
use super::{Send, Connect, Disconnect, Connection, Subscribe, Unsubscribe};
use actix::{prelude::{Actor, Context, Handler}, Addr};
use std::collections::{HashMap};

#[derive(Debug)]
pub struct Server {
    connections: HashMap<String, (User, Addr<Connection>)>,
    events: HashMap<String, HashMap<String, Addr<Connection>>>,
}

impl Actor for Server {
    type Context = Context<Self>;
}

impl Server {
    pub fn new() -> Server {
        Server {
            connections: HashMap::new(),
            events: HashMap::new(),
        }
    }

    fn send_msg(&self, id: String, msg: &str) {
        if let Some(connection) = self.connections.get(&id) {
            connection.1.do_send(Send(msg.to_owned()));
        } else {
            println!("Failed to send message \"{}\" to {}. Id not found.", msg, id);
        }
    }

    fn emit_event(&self, event: &str, data: &str, ids: &Vec<String>) {
        if let Some(subscribed) = self.events.get(event) {
            for id in ids {
                if let Some(addr) = subscribed.get(id) {
                    addr.do_send(Send(format!("{{\"event\": \"{}\", \"data\": \"{}\"}}", event, data)))
                }
            }
        }
    }
}

impl Handler<Connect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) {
        let friend_ids =  msg.user.friends.iter().map(|id| id.to_string()).collect();
        self.emit_event("login", &msg.user._id.to_string(), &friend_ids);


        self.connections.insert(msg.user._id.to_string(), (msg.user, msg.addr));
    }
}

impl Handler<Subscribe> for Server {
    type Result = ();

    fn handle(&mut self, msg: Subscribe, _: &mut Context<Self>) {
        if let Some((_, addr)) = self.connections.get(&msg._id) {
            if !self.events.contains_key(&msg.event) {
                self.events.insert(msg.event.clone(), HashMap::new());
            }

            self.events.get_mut(&msg.event).unwrap().insert(msg._id, addr.clone());
        }
    }
}

impl Handler<Unsubscribe> for Server {
    type Result = ();

    fn handle(&mut self, msg: Unsubscribe, _: &mut Context<Self>) {
        if let Some(subscribed) = self.events.get_mut(&msg.event) {
            subscribed.remove(&msg._id);
        }
    }
}

impl Handler<Disconnect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        if let Some((user, _)) = self.connections.remove(&msg._id) {
            let friend_ids =  user.friends.iter().map(|id| id.to_string()).collect();
            self.emit_event("logout", &user._id.to_string(), &friend_ids);
        }
    }
}