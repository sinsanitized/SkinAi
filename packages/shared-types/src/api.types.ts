export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
};

export interface ErrorResponse {
    success: false;
    error: string;
    details?: string;
};