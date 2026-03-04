const success = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, data });
};
const paginated = (res, data, pagination) => {
  res.status(200).json({ success: true, data, pagination });
};
module.exports = { success, paginated };