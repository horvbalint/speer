use crate::schemas::User;
use super::{Send, Dispatch, Connect, Disconnect, Connection, Subscribe, Unsubscribe, Signal, ConnectedIds};
use actix::{prelude::{Actor, Context, Handler}, Addr, WrapFuture, ContextFutureSpawner};
use mongodb::{bson::{oid::ObjectId, doc}, Collection};
use serde::Serialize;
use serde_json::json;
use std::{collections::{HashMap}, rc::Rc};

#[derive(Debug)]
pub struct Server {
    connections: Rc<HashMap<ObjectId, (User, Addr<Connection>)>>,
    events: Rc<HashMap<String, HashMap<ObjectId, Addr<Connection>>>>,
    users_coll: Rc<Collection<User>>,
}

impl Actor for Server {
    type Context = Context<Self>;
}

impl Server {
    pub fn new(users_coll: Collection<User>) -> Server {
        Server {
            connections: Rc::new(HashMap::new()),
            events: Rc::new(HashMap::new()),
            users_coll: Rc::new(users_coll),
        }
    }

    fn emit_event<T: Serialize>(&self, event: &str, data: Box<T>, ids: &Vec<ObjectId>) {
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
        self.emit_event("login", Box::new(&msg.user._id.to_string()), &msg.user.friends);


        Rc::get_mut(&mut self.connections)
            .and_then(|connections| connections.insert(msg.user._id, (msg.user, msg.addr)));
    }
}

impl Handler<Subscribe> for Server {
    type Result = ();

    fn handle(&mut self, msg: Subscribe, _: &mut Context<Self>) {
        let used_fields = (
            Rc::get_mut(&mut self.events),
            self.connections.get(&msg._id)
        );

        if let (Some(events), Some((_, addr))) = used_fields {
            if !events.contains_key(&msg.event) {
                events.insert(msg.event.clone(), HashMap::new());
            }

            events.get_mut(&msg.event).unwrap().insert(msg._id, addr.clone());
        }
    }
}

impl Handler<Unsubscribe> for Server {
    type Result = ();

    fn handle(&mut self, msg: Unsubscribe, _: &mut Context<Self>) {
        Rc::get_mut(&mut self.events)
            .and_then(|events| events.get_mut(&msg.event))
            .and_then(|subscribed| subscribed.remove(&msg._id));
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

        let send_msg = move |id: ObjectId, msg: serde_json::Value| {
            connections.get(&id)
                .map(|(_, addr)| addr.do_send(Send(msg.to_string())));
        };

        let future = async move {
            if let Ok(Some(user))= users_coll.find_one(doc!{"_id": &msg._id}, None).await {
                if user.friends.contains(&msg.remote_id) {
                    let payload = json!({
                        "action": "signal",
                        "peerData": msg.peer_data,
                        "remoteId": msg._id.to_string(),
                        "type": msg.r#type,
                        "data": msg.data,
                        "msgType": "signal"
                    });

                    send_msg(msg.remote_id, payload)
                }
                else {
                    let payload = json!({
                        "error": "Not friend",
                        "remoteId": msg.remote_id.to_string(),
                        "msgType": "signal"
                    });

                    send_msg(msg._id, payload)
                };
            }
        };

        future.into_actor(self).spawn(ctx);
    }
}

impl Handler<Disconnect> for Server {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        Rc::get_mut(&mut self.connections)
            .and_then(|connections| connections.remove(&msg._id))
            .map( |(user, _)| self.emit_event("logout", Box::new(&user._id.to_string()), &user.friends) );

        Rc::get_mut(&mut self.events)
            .map( |events| events.iter_mut() )
            .map( |events| events.for_each(|(_, map)| {map.remove(&msg._id);}) );
    }
}

impl Handler<ConnectedIds> for Server {
    type Result = Option<Vec<ObjectId>>;

    fn handle(&mut self, _: ConnectedIds, _: &mut Context<Self>) -> Self::Result {
        let res = self.connections.keys().map(|key| key.clone()).collect();
        Some(res)
    }
}

impl Handler<Dispatch> for Server {
    type Result = ();

    fn handle(&mut self, msg: Dispatch, _: &mut Context<Self>) {
        self.emit_event(&msg.event, Box::new(&msg.payload), &msg.filter);
    }
}