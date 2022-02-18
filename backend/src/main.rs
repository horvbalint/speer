extern crate dotenv;

use dotenv::dotenv;
use actix::Actor;
use actix_cors::Cors;
use actix_web::{web, App, FromRequest, HttpServer, middleware::Logger};
use mongodb::{Client, options::ClientOptions};
use serde::Deserialize;
use serde_json::{Map, Value};
use env_logger;
use std::{env, fs};

mod schemas;
mod routes;
mod utils;
mod mail;
mod jwt;
mod ws;

pub struct CurrDir{
    path: String
}

#[derive(Deserialize, Debug)]
pub struct EnvVars {
    cookie_secret: String,
    confirm_secret: String,
    mailjet_public: String,
    mailjet_secret: String,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let client_options = ClientOptions::parse("mongodb://localhost:27017/?retryWrites=false").await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("speer");
    let ws_server = ws::Server::new(db.collection::<schemas::User>("users")).start();

    HttpServer::new(move || {
        let env_vars = envy::prefixed("SPEER_").from_env::<EnvVars>().unwrap();
        let cors = Cors::default()
            .allowed_origin("http://localhost:9000")
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();
        let curr_dir = CurrDir {
            path: env::current_dir().unwrap().to_str().unwrap().to_string()
        };
        let limit_file_size = awmp::Parts::configure(|cfg| cfg.with_file_limit(20_000_000));
        let json_string = fs::read_to_string("changelog.json").unwrap();
        let changelog = serde_json::from_str::<Map<String, Value>>(&json_string).unwrap();
        
        App::new()
            .data(limit_file_size)
            .data(env_vars)
            .data(client.clone())
            .data(db.clone())
            .data(db.collection::<schemas::MinimalUser>("users"))
            .data(db.collection::<schemas::User>("users"))
            .data(db.collection::<schemas::Confirm>("confirms"))
            .data(curr_dir)
            .data(ws_server.clone())
            .data(changelog)
            .wrap(cors)
            .wrap(Logger::default())
            .route("/ws/", web::get().to(ws::ws_route))
            .service(routes::register_handler)
            .service(routes::login_handler)
            .service(routes::logout_handler)
            .service(routes::confirm_handler)
            .service(routes::cancel_handler)
            .service(routes::resend_confirmation_handler)
            .service(routes::avatar_handler)
            .service(routes::user_by_email_handler)
            .service(routes::me_handler)
            .service(routes::onlines_handler)
            .service(routes::online_handler)
            .service(routes::friends_handler)
            .service(routes::request_id_handler)
            .service(routes::request_handler)
            .service(routes::accept_id_handler)
            .service(routes::decline_id_handler)
            .service(routes::changelog_version_handler)
            .service(routes::changelog_handler)
            .service(routes::breaking_version_handler)
            .service(routes::files_handler)
    })
        .bind("localhost:9001")?
        .run()
        .await
}
