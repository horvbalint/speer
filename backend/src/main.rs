use actix_cors::Cors;
use actix_web::{App, HttpServer, middleware::Logger};
use mongodb::{
    options::ClientOptions,
    Client,
};
use env_logger;
use std::env;

mod schemas;
mod routes;
mod jwt;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env::set_var("RUST_LOG", "actix_web=debug");
    env_logger::init();

    let client_options = ClientOptions::parse("mongodb://localhost:27017").await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("speer");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:9000")
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .data(db.clone())
            .wrap(cors)
            .wrap(Logger::default())
            .service(routes::login)
            .service(routes::me)
            .service(routes::friends)
            .service(routes::user_by_email)
            .service(routes::files)
    })
        .bind("localhost:9001")?
        .run()
        .await
}
