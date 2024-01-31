use serde_json::{json, Value};
use std::fs;

use crate::{schemas::Feedback, utils::MapAndLog, EnvVars};

#[cfg(debug_assertions)]
pub async fn send_confirmation(
    _username: &str,
    _email: &str,
    token: &str,
    env_vars: &EnvVars,
) -> Result<(), String> {
    println!(
        "CONFIRM REGISTRATION: \n {}/confirm?token={token}",
        env_vars.frontend_url
    );
    println!(
        "CANCEL REGISTRATION: \n {}/cancel?token={token}",
        env_vars.frontend_url
    );

    Ok(())
}

#[cfg(not(debug_assertions))]
pub async fn send_confirmation(
    username: &str,
    email: &str,
    token: &str,
    env_vars: &EnvVars,
) -> Result<(), String> {
    let mut html = fs::read_to_string("emails/emailConfirmation.html")
        .log_and_map("Failed to open email template")?;

    html = html.replace(
        "{{CONFIRM_URL}}",
        format!("{}/confirm?token={token}", env_vars.frontend_url).as_str(),
    );
    html = html.replace(
        "{{CANCEL_URL}}",
        format!("{}/cancel?token={token}", env_vars.frontend_url).as_str(),
    );
    html = html.replace("{{USERNAME}}", &html_escape::encode_safe(username));

    let content = json!({
      "Messages":[
        {
          "From": {
            "Name": "Speer",
            "Email": &env_vars.noreply_email,
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

pub async fn send_feedback_notification(
    feedback: &Feedback,
    env_vars: &EnvVars,
) -> Result<(), String> {
    let mut html = fs::read_to_string("emails/feedbackNotification.html")
        .log_and_map("Failed to open email template")?;

    html = html.replace("{{TYPE}}", &html_escape::encode_safe(&feedback.r#type));
    html = html.replace(
        "{{DATE}}",
        &html_escape::encode_safe(&feedback.date.to_string()),
    );
    html = html.replace("{{VERSION}}", &html_escape::encode_safe(&feedback.version));
    html = html.replace(
        "{{DESCRIPTION}}",
        &html_escape::encode_safe(&feedback.description),
    );

    let content = json!({
      "Messages":[
        {
          "From": {
            "Name": "Speer",
            "Email": &env_vars.noreply_email,
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
    let response = client
        .post("https://api.mailjet.com/v3.1/send")
        .basic_auth(
            env_vars.mailjet_public.as_str(),
            Some(env_vars.mailjet_secret.as_str()),
        )
        .json(&content)
        .send()
        .await
        .log_and_map("Failed to send email")?;

    if !response.status().is_success() {
        eprintln!("{:#?}", response.status());
        return Err(format!("Mailjet API error: {}", response.status()));
    }

    Ok(())
}
