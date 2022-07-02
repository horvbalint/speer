extern crate dotenv;

use dotenv::dotenv;
use actix::Actor;
use actix_cors::Cors;
use actix_web::{web::{self, Data}, App, HttpServer, middleware::Logger};
use mongodb::{Client, options::ClientOptions};
use serde::Deserialize;
use serde_json::{Map, Value};

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

#[derive(Deserialize, Debug, Clone)]
pub struct EnvVars {
    server_port: Option<i32>,
    cookie_secret: String,
    confirm_secret: String,
    mailjet_public: String,
    mailjet_secret: String,
    admin_email: String,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().expect("\n\nNo '.env' file can be found in the current working directory. Check if the file exists in the current working directory.\nYou can find information about the file in the documentation: https://github.com/horvbalint/speer#backendenv\n\n");
    env_logger::init();

    let client_options = ClientOptions::parse("mongodb://localhost:27017/").await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("speer");
    let ws_server = ws::Server::new(db.collection::<schemas::User>("users")).start();
    let env_vars = envy::prefixed("SPEER_").from_env::<EnvVars>().unwrap();
    let env_vars_clone = env_vars.clone();
    
    let server = HttpServer::new(move || {
        let env_vars_clone = env_vars_clone.clone();
        let cors = Cors::default()
            .allowed_origin("http://localhost:9000")
            .allowed_origin("https://speer.fun")
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();
        let curr_dir = CurrDir {
            path: env::current_dir().unwrap().to_str().unwrap().to_string()
        };
        let limit_file_size = awmp::PartsConfig::default().with_file_limit(20_000_000);
        let json_string = fs::read_to_string("changelog.json").unwrap();
        let changelog = serde_json::from_str::<Map<String, Value>>(&json_string).unwrap();
        
        App::new()
            .app_data(Data::new(limit_file_size))
            .app_data(Data::new(env_vars_clone))
            .app_data(Data::new(client.clone()))
            .app_data(Data::new(db.clone()))
            .app_data(Data::new(db.collection::<schemas::MinimalUser>("users")))
            .app_data(Data::new(db.collection::<schemas::User>("users")))
            .app_data(Data::new(db.collection::<schemas::Confirm>("confirms")))
            .app_data(Data::new(curr_dir))
            .app_data(Data::new(ws_server.clone()))
            .app_data(Data::new(changelog))
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
            .service(routes::add_device_handler)
            .service(routes::remove_device_handler)
            .service(routes::test_devices_handler)
            .service(routes::ping_handler)
            .service(routes::changelog_version_handler)
            .service(routes::changelog_handler)
            .service(routes::breaking_version_handler)
            .service(routes::feedback_handler)
            .service(routes::log_handler)
            .service(routes::files_handler)
    });

    println!("The dark side of the 🌑 is ready!");

    let server_addr = format!("localhost:{}", env_vars.server_port.unwrap_or(9001));
    server.bind(server_addr)?.run().await
}
