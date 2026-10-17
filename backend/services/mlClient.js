const { ServiceError } = require("./errors");

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function postToMl(path, body, timeoutMs = 60000) {
  let response;
  try {
    response = await fetch(`${ML_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    console.error(`ML service request to ${path} failed:`, err.message);
    throw new ServiceError(503, "The Python ML service is not reachable. Start ml-service on port 8000 and retry.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join("; ") : data.detail;
    const status = [422, 501].includes(response.status) ? response.status : 502;
    throw new ServiceError(status, detail || data.message || "The Python ML service could not complete this request.");
  }
  return data;
}

module.exports = { postToMl };
