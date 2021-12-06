use std::{time::{Instant, Duration}};
use actix::{Actor, StreamHandler, Running, Addr, AsyncContext, ActorContext, Handler};
use actix_web::{web::{self, Data}, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;

use crate::schemas::User;
use crate::ws::message;
use crate::ws::server;

use super::Server;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

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
            Ok(ws::Message::Text(_text)) => {},
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
}

pub async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    server: Data<Addr<Server>>,
    user: User
) -> Result<HttpResponse, Error> {
    let connection = Connection {
        hb: Instant::now(),
        server: server.get_ref().clone(),
        user,
    };

    ws::start(connection, &req, stream)
}