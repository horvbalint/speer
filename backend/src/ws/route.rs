use actix::Addr;
use actix_web::{web::{self, Data}, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use crate::schemas::User;
use super::{Server, Connection};

pub async fn ws_route(
  req: HttpRequest,
  stream: web::Payload,
  server: Data<Addr<Server>>,
  user: User
) -> Result<HttpResponse, Error> {
  let connection = Connection::new(user, server.get_ref().clone());

  ws::start(connection, &req, stream)
}