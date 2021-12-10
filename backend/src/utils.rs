use mongodb::{bson::Document, options::FindOneOptions};
use rand::{distributions::Alphanumeric, Rng};

pub fn generate_random_string(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect::<String>()
        .to_lowercase()
}

pub fn create_projection(projection: Document) -> FindOneOptions {
    FindOneOptions::builder() 
                    .projection(projection)
                    .build()
}
