use std::{time::{Instant, Duration}};
use actix::{Actor, StreamHandler, Running, Addr, AsyncContext, ActorContext, Handler};
use actix_web_actors::ws;
use serde::Deserialize;

use crate::schemas::User;
use crate::ws::message;
use crate::ws::server;

use super::Signal;


const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Deserialize)]
struct PusherMessage {
    action: String,
    event: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SingalMessage {
    action: String,
    peer_data: String,
    remote_id: String,
    r#type: String,
    data: Option<String>
}

#[derive(Debug)]
pub struct Connection {
    user: User,
    hb: Instant,
    server: Addr<server::Server>
}

impl Actor for Connection {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);

        self.server.do_send(message::Connect {
            addr: ctx.address(),
            user: self.user.clone(),
        })
    }

    fn stopping(&mut self, ctx: &mut Self::Context) -> Running {
        self.server.do_send(message::Disconnect {
            _id: self.user._id.to_string(),
        });

        ctx.close(None);

        Running::Stop
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for Connection {
    fn handle(
        &mut self,
        msg: Result<ws::Message, ws::ProtocolError>,
        ctx: &mut Self::Context,
    ) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Pong(_)) => self.hb = Instant::now(),
            Ok(ws::Message::Text(text)) => {
                match serde_json::from_str(&text) {
                    Ok(PusherMessage { action, event }) => self.handle_pusher_msg(action, event),
                    _ => {
                        match serde_json::from_str(&text) {
                            Ok(SingalMessage { action, peer_data, remote_id, r#type, data }) => {
                                self.server.do_send(Signal {
                                    _id: self.user._id.to_string(),
                                    action,
                                    peer_data: peer_data,
                                    remote_id: remote_id,
                                    r#type,
                                    data,
                                });
                            },
                            _ => println!("MESSAGE UNRECOGNIZED: {}", text)
                        }
                    }
                }
            },
            Ok(ws::Message::Close(_)) => ctx.stop(),
            _ => (),
        }
    }
}

impl Handler<message::Send> for Connection {
    type Result = ();

    fn handle(&mut self, msg: message::Send, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl Connection {
    pub fn new(user: User, server: Addr<server::Server>) -> Connection {
        Connection {
            hb: Instant::now(),
            user,
            server
        }
    }

    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                println!("Disconnecting failed heartbeat");
                ctx.stop();
                return;
            }

            ctx.ping(b"PING");
        });
    }

    fn handle_pusher_msg(&self, action: String, event: String) {
        match action.as_str() {
            "subscribe" => {
                self.server.do_send(message::Subscribe{
                    event,
                    _id: self.user._id.to_string()
                })
            },
            "unsubscribe" => {
                self.server.do_send(message::Unsubscribe{
                    event,
                    _id: self.user._id.to_string()
                })
            },
            _ => {}
        }
    }
}