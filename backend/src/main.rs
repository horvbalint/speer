use actix_cors::Cors;
use actix_web::{App, FromRequest, HttpServer, middleware::Logger};
use mongodb::{Client, options::ClientOptions};
use env_logger;
use std::env;

mod schemas;
mod routes;
mod utils;
mod jwt;

pub struct CurrDir{
    path: String
}
impl CurrDir {
    fn new(path: String) -> Self {
        Self{path}
    }
}

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
            .data(db.collection_with_type::<schemas::User>("users"))
            .data(db.collection_with_type::<schemas::Confirm>("confirms"))
            .data(CurrDir::new(env::current_dir().unwrap().to_str().unwrap().to_string()))
            .data(awmp::Parts::configure(|cfg| cfg.with_file_limit(20_000_000)))
            .wrap(cors)
            .wrap(Logger::default())
            .service(routes::login_handler)
            .service(routes::logout_handler)
            .service(routes::confirm_handler)
            .service(routes::cancel_handler)
            .service(routes::resend_confirmation_handler)
            .service(routes::avatar_handler)
            .service(routes::user_by_email_handler)
            .service(routes::me_handler)
            .service(routes::friends_handler)
            .service(routes::files_handler)
    })
        .bind("localhost:9001")?
        .run()
        .await
}
