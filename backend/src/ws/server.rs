use crate::schemas::User;
use super::{Send, Dispatch, Connect, Disconnect, Connection, Subscribe, Unsubscribe, Signal, ConnectedIds};
use actix::{prelude::{Actor, Context, Handler}, Addr, WrapFuture, ContextFutureSpawner};
use mongodb::{bson::{oid::ObjectId, doc}, Collection};
use serde::Serialize;
use serde_json::json;
use std::{collections::{HashMap}, str::FromStr};

#[derive(Debug)]
pub struct Server {
    connections: HashMap<String, (User, Addr<Connection>)>,
    events: HashMap<String, HashMap<String, Addr<Connection>>>,
    users_coll: Collection<User>,
}

impl Actor for Server {
    type Context = Context<Self>;
}

impl Server {
    pub fn new(users_coll: Collection<User>) -> Server {
        Server {
            connections: HashMap::new(),
            events: HashMap::new(),
            users_coll,
        }
    }

    fn send_msg(&self, id: String, msg: String) {
        if let Some((_, addr)) = self.connections.get(&id) {
            addr.do_send(Send(msg));
        } else {
            println!("Failed to send message '{}' to {}. Id not found.", msg, id);
        }
    }

    fn emit_event<T: Serialize>(&self, event: &str, data: Box<T>, ids: &Vec<String>) {
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
        self.emit_event("login", Box::new(&msg.user._id.to_string()), &friend_ids);


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

    // TO REVIEW: This handler really isn't pretty.
    // The send_msg function here is the same as the self.send_msg method, but I couldn't manage to use that
    // inside the async block.
    // I really dislike the error handling as well, it would be great to use the '?' operator, but I was not able
    // to get it to work.
    fn handle(&mut self, msg: Signal, ctx: &mut Context<Self>) {
        let connections = self.connections.clone();
        let users_coll = self.users_coll.clone();

        let send_msg = move |id: String, msg: String| {
            if let Some((_, addr)) = connections.get(&id) {
                addr.do_send(Send(msg));
            } else {
                println!("Failed to send message '{}' to {}. Id not found.", msg, id);
            }
        };

        let future = async move {
            if let Ok(id) = ObjectId::from_str(&msg._id) {
                let used_fields = (
                    users_coll.find_one(doc!{"_id": id}, None).await,
                    ObjectId::from_str(&msg.remote_id)
                );
        
                if let (Ok(Some(user)), Ok(remote_id)) = used_fields {
                    if user.friends.contains(&remote_id) {
                        let message = json!({
                            "action": "signal",
                            "peerData": msg.peer_data,
                            "remoteId": msg._id,
                            "type": msg.r#type,
                            "data": msg.data,
                            "msgType": "signal"
                        });
    
                        send_msg(msg.remote_id, message.to_string());
                    } else {
                        let message = json!({
                            "error": "Not friend",
                            "remoteId": msg.remote_id,
                            "msgType": "signal"
                        });
    
                        send_msg(msg._id, message.to_string());
                    }
                }
            }
        };

        future.into_actor(self).spawn(ctx);
    }
}

impl Handler<Disconnect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        if let Some((user, _)) = self.connections.remove(&msg._id) {
            let friend_ids =  user.friends.iter().map(|id| id.to_string()).collect();
            self.emit_event("logout", Box::new(&user._id.to_string()), &friend_ids);
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

impl Handler<Dispatch> for Server {
    type Result = ();

    fn handle(&mut self, msg: Dispatch, _: &mut Context<Self>) {
        self.emit_event(&msg.event, Box::new(&msg.payload), &msg.filter);
    }
}
