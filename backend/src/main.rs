use cookie::{Key, time::Duration, SameSite};
use dotenv::dotenv;
use actix::Actor;
use actix_cors::Cors;
use actix_web::{web::{self, Data}, App, HttpServer, middleware::Logger};
use mongodb::{Client, options::ClientOptions};
use serde::Deserialize;
use serde_json::{Map, Value};
use actix_identity::IdentityMiddleware;
use actix_session::{storage::RedisActorSessionStore, SessionMiddleware, config::PersistentSession};
use std::{env, fs};

mod schemas;
mod routes;
mod utils;
mod mail;
mod ws;

const SECS_IN_DAY: i64 = 60 * 60 * 24;

pub struct CurrDir{
    path: String
}

#[derive(Deserialize, Debug, Clone)]
pub struct EnvVars {
    cookie_secret: String,
    confirm_secret: String,
    mailjet_public: String,
    mailjet_secret: String,
    admin_email: String,
    noreply_email: String,
    #[serde(default = "default_server_address")]
    server_address: String,
    #[serde(default = "default_redis_address")]
    redis_address: String,
    #[serde(default = "default_mongo_url")]
    mongo_url: String,
    #[serde(default = "default_frontend_url")]
    frontend_url: String,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    if let Err(_) = dotenv() {
        println!("[Info] No '.env' file can be found in the current working directory, or it is formatted badly.\nYou can find information about the file in the documentation: https://github.com/horvbalint/speer#backendenv");
    }

    env_logger::init();

    let env_vars = envy::prefixed("SPEER_").from_env::<EnvVars>().unwrap();
    let server_address = env_vars.server_address.clone();

    let client_options = ClientOptions::parse(&env_vars.mongo_url).await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("speer");
    let ws_server = ws::Server::new(db.collection::<schemas::User>("users")).start();

    let server = HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&env_vars.frontend_url)
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();
        let curr_dir = CurrDir {
          path: env::current_dir().unwrap().to_str().unwrap().to_string()
        };
        let limit_file_size = awmp::PartsConfig::default().with_file_limit(20_000_000);
        let json_string = fs::read_to_string("changelog.json").unwrap();
        let changelog = serde_json::from_str::<Map<String, Value>>(&json_string).unwrap();

        let session_middleware = SessionMiddleware::builder(
          RedisActorSessionStore::new(&env_vars.redis_address),
          Key::from(env_vars.cookie_secret.as_ref())
        )
            .cookie_same_site(SameSite::Strict)
            .session_lifecycle(PersistentSession::default().session_ttl(Duration::seconds(SECS_IN_DAY)))
            .build();

        App::new()
            .app_data(Data::new(limit_file_size))
            .app_data(Data::new(env_vars.clone()))
            .app_data(Data::new(client.clone()))
            .app_data(Data::new(db.clone()))
            .app_data(Data::new(db.collection::<schemas::MinimalUser>("users")))
            .app_data(Data::new(db.collection::<schemas::User>("users")))
            .app_data(Data::new(db.collection::<schemas::Confirm>("confirms")))
            .app_data(Data::new(curr_dir))
            .app_data(Data::new(ws_server.clone()))
            .app_data(Data::new(changelog))
            .wrap(IdentityMiddleware::default())
            .wrap(session_middleware)
            .wrap(Logger::default())
            .wrap(cors)
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
    println!("Listening at address: {}", server_address);

    server.bind(server_address)?.run().await
}

fn default_server_address() -> String {
    "localhost:9001".to_string()
}

fn default_redis_address() -> String {
    "localhost:6379".to_string()
}

fn default_mongo_url() -> String {
    "mongodb://localhost:27017".to_string()
}

fn default_frontend_url() -> String {
    "http://localhost:9000".to_string()
}
