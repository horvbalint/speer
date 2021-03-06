use std::fs;
use serde_json::{json, Value};

use crate::{EnvVars, schemas::Feedback};

#[cfg(debug_assertions)]
pub async fn send_confirmation(_username: &str, _email: &str, token: &str, _env_vars: &EnvVars) -> Result<(), String> {
  println!("CONFIRM REGISTRATION: \n http://localhost:9000/confirm?token={}", token);
  println!("CANCEL REGISTRATION: \n http://localhost:9000/cancel?token={}", token);

  Ok(())
}

#[cfg(not(debug_assertions))]
pub async fn send_confirmation(username: &str, email: &str, token: &str, env_vars: &EnvVars) -> Result<(), String> {
  let mut html = fs::read_to_string("emails/emailConfirmation.html")
    .map_err(|_| "Failed to open email template".to_string())?;

  html = html.replace("{{CONFIRM_URL}}", format!("https://speer.fun/confirm?token={token}").as_str());
  html = html.replace("{{CANCEL_URL}}", format!("https://speer.fun/cancel?token={token}").as_str());
  html = html.replace("{{USERNAME}}", &html_escape::encode_safe(username));

  let content = json!({
    "Messages":[
      {
        "From": {
          "Name": "Speer",
          "Email": "noreply@speer.fun",
        },
        "To": [{
          "Name": &username,
          "Email": &email,
        }],
        "Subject": "Speer - Confirm your email",
        "HTMLPart": &html,
      }
    ]
  });

  send_email(content, env_vars).await
}

pub async fn send_feedback_notification(feedback: &Feedback, env_vars: &EnvVars) -> Result<(), String> {
  let mut html = fs::read_to_string("emails/feedbackNotification.html")
    .map_err(|_| "Failed to open email template".to_string())?;

  html = html.replace("{{TYPE}}", &html_escape::encode_safe(&feedback.r#type));
  html = html.replace("{{DATE}}", &html_escape::encode_safe(&feedback.date.to_string()));
  html = html.replace("{{VERSION}}", &html_escape::encode_safe(&feedback.version));
  html = html.replace("{{DESCRIPTION}}", &html_escape::encode_safe(&feedback.description));

  let content = json!({
    "Messages":[
      {
        "From": {
          "Name": "Speer",
          "Email": "noreply@speer.fun",
        },
        "To": [{
          "Name": "Admin",
          "Email": &env_vars.admin_email,
        }],
        "Subject": "Speer - New feedback",
        "HTMLPart": &html,
      }
    ]
  });

  send_email(content, env_vars).await
}

async fn send_email(content: Value, env_vars: &EnvVars) -> Result<(), String> {
  let client = reqwest::Client::new();
  let response = client.post("https://api.mailjet.com/v3.1/send")
    .basic_auth(env_vars.mailjet_public.as_str(), Some(env_vars.mailjet_secret.as_str()))
    .json(&content)
    .send()
    .await
    .or_else(|_| Err("Failed to send email".to_string()))?;

  if !response.status().is_success() {
    return Err(format!("Mailjet API error: {}", response.status()) );
  }

  Ok(())
}