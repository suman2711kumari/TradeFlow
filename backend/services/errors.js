// A typed error whose message is safe to show to the user.
class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}
module.exports = { ServiceError };
