# 🚧 WORK IN PROGRESS 🚧

If you came here to review the code first of all **thank you** and please skip to the next chapter.

This branch is currently just a playground for me while trying out Rust. The plan is to rewrite the backend of Speer in Rust to make it faster and more efficient. Also I really wanted to learn web development in Rust so this seemed like a great solution for that. 

If you are looking for the **actual source code of Speer** look at the **'main'** branch of this repository.

## For reviewers

Thank you for your time. I tried to help a bit and created some comments starting with **'TO REVIEW:'** at those places where I am sure that there are better ways to achive what I tried to do.

The repository contains both the front and the back-end parts, all the Rust code can be found inside the 'backend' folder.

### To start the project

To start the project just execute the following commands from the root of the repository:

`npm run dev` - starts the frontend, it will be accessible at http://localhost:9000

`npm run server`- starts the backend (also whatches for changes in the 'backend/src' folder)

### Requirements:

- The project uses **Node.js** (v.14 or higher)
- The database is **MongoDB**, so you need to have a MongoDB server running at the default port.

One will also have to create some config files:

#### backend/.env
```
SPEER_COOKIE_SECRET=secret
SPEER_CONFIRM_SECRET=secret
SPEER_MAILJET_PUBLIC=api_public_key
SPEER_MAILJET_SECRET=api_private_key
```
These values can be anything, except if you want to test out email sending. Then you need an account at [mailjet](https://mailjet.com) and use the provided keys.

#### backend/vapid.pem

This file is only needed if you want to test push notifications. It can be generated by following the steps provided by the [web-push](https://crates.io/crates/web-push) crate. If you do test this funcionality, you also need to replace the corresponding public key in the file **frontend/components/popUp/profile.vue** (line 100) and start the frontend with `npm run generate && npm run start` instead of `npm run dev`.