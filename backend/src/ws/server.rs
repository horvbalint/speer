use crate::schemas::User;
use super::{Send, Connect, Disconnect, Connection, Subscribe, Unsubscribe, Signal, ConnectedIds};
use actix::{prelude::{Actor, Context, Handler}, Addr};
use mongodb::bson::oid::ObjectId;
use serde_json::json;
use std::{collections::{HashMap}, str::FromStr};

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

    fn send_msg(&self, id: String, msg: String) {
        if let Some((_, addr)) = self.connections.get(&id) {
            addr.do_send(Send(msg));
        } else {
            println!("Failed to send message '{}' to {}. Id not found.", msg, id);
        }
    }

    fn emit_event(&self, event: &str, data: &str, ids: &Vec<String>) {
        if let Some(subscribed) = self.events.get(event) {
            for id in ids {
                if let Some(addr) = subscribed.get(id) {
                    let message = json!({
                        "event": event,
                        "data": data,
                        "msgType": "pusher"
                    });

                    addr.do_send(Send(message.to_string()));
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

impl Handler<Signal> for Server {
    type Result = ();

    fn handle(&mut self, msg: Signal, _: &mut Context<Self>) {
        let used_fields = (
            self.connections.get(&msg._id),
            ObjectId::from_str(&msg.remote_id)
        );

        if let (Some((user, _)), Ok(remote_id)) = used_fields {
            if user.friends.contains(&remote_id) {
                let message = json!({
                    "action": "signal",
                    "peerData": msg.peer_data,
                    "remoteId": msg._id,
                    "type": msg.r#type,
                    "data": msg.data,
                    "msgType": "signal"
                });

                self.send_msg(msg.remote_id, message.to_string());
            } else {
                let message = json!({
                    "error": "Not friend",
                    "remoteId": msg.remote_id,
                    "msgType": "signal"
                });

                self.send_msg(msg.remote_id, message.to_string());
            }
        };
    }
}

impl Handler<Disconnect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        if let Some((user, _)) = self.connections.remove(&msg._id) {
            let friend_ids =  user.friends.iter().map(|id| id.to_string()).collect();
            self.emit_event("logout", &user._id.to_string(), &friend_ids);
        }

        for (_, map) in self.events.iter_mut() {
            map.remove(&msg._id);
        }
    }
}

impl Handler<ConnectedIds> for Server {
    type Result = Option<Vec<String>>;

    fn handle(&mut self, _: ConnectedIds, _: &mut Context<Self>) -> Self::Result {
        Some(
            self.connections.keys()
                            .map(|key| key.clone())
                            .collect()
        )
    }
}