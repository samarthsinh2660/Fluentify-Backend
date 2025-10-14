// Standard success response format
function successResponse(data, message) {
  return {
    success: true,
    message: message || "Operation successful",
    data,
    timestamp: new Date().toISOString()
  };
}

// Standard error response format
function errorResponse(message, code = 10000) {
  return {
    success: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };
}

// Response for list operations without pagination
function listResponse(data, message, meta) {
  return {
    success: true,
    message: message || "Data retrieved successfully",
    data,
    meta: meta || { count: data.length },
    timestamp: new Date().toISOString()
  };
}

// Response for creation operations
function createdResponse(data, message) {
  return {
    success: true,
    message: message || "Resource created successfully",
    data,
    timestamp: new Date().toISOString()
  };
}

// Response for update operations
function updatedResponse(data, message) {
  return {
    success: true,
    message: message || "Resource updated successfully",
    data,
    timestamp: new Date().toISOString()
  };
}

// Response for delete operations
function deletedResponse(message) {
  return {
    success: true,
    message: message || "Resource deleted successfully",
    timestamp: new Date().toISOString()
  };
}

// Response for authentication operations
function authResponse(data, message) {
  return {
    success: true,
    message: message || "Authentication successful",
    data: {
      user: data.user,
      token: data.token
    },
    timestamp: new Date().toISOString()
  };
}

export {
  successResponse,
  errorResponse,
  listResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  authResponse
};
