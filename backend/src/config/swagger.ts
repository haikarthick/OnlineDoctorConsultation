/**
 * Swagger / OpenAPI Configuration
 *
 * Generates comprehensive API documentation from a programmatic spec
 * covering all 200+ endpoints in the VetCare platform.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const apiVersion = 'v1';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'VetCare API',
      version: '1.0.0',
      description: 'Enterprise Veterinary Consultation Platform — complete REST API documentation.',
      contact: { name: 'VetCare Team', email: 'support@vetcare.app' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: `http://localhost:3000/api/${apiVersion}`, description: 'Local development' },
      { url: `/api/${apiVersion}`, description: 'Relative (production behind proxy)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                statusCode: { type: 'integer' },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['pet_owner', 'farmer', 'veterinarian', 'admin'] },
            phone: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Consultation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            vetId: { type: 'string', format: 'uuid' },
            animalId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['video_call', 'in_person', 'phone', 'chat'] },
            status: { type: 'string', enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
            reason: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Animal: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ownerId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            species: { type: 'string' },
            breed: { type: 'string' },
            dateOfBirth: { type: 'string', format: 'date' },
            weight: { type: 'number' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            type: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            isRead: { type: 'boolean' },
            channel: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            consultationId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'completed', 'refunded', 'failed'] },
            method: { type: 'string' },
          },
        },
        StoredFile: {
          type: 'object',
          properties: {
            originalName: { type: 'string' },
            fileName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'integer' },
            url: { type: 'string' },
            key: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & registration' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Consultations', description: 'Consultation lifecycle' },
      { name: 'Bookings', description: 'Booking & scheduling' },
      { name: 'Video', description: 'Video session management' },
      { name: 'Schedule', description: 'Vet schedule management' },
      { name: 'Prescriptions', description: 'Prescription management' },
      { name: 'Animals', description: 'Animal / pet management' },
      { name: 'Vet Profiles', description: 'Veterinarian profiles' },
      { name: 'Medical Records', description: 'Medical records, vaccinations, weight, allergies, labs' },
      { name: 'Notifications', description: 'In-app & email notifications' },
      { name: 'Payments', description: 'Payment processing' },
      { name: 'Reviews', description: 'Consultation reviews' },
      { name: 'Admin', description: 'Admin dashboard & management' },
      { name: 'Enterprise', description: 'Enterprise, groups, locations, movements, campaigns' },
      { name: 'Health Analytics', description: 'Tier 2 – health observations & analytics' },
      { name: 'Breeding', description: 'Tier 2 – breeding & genetics' },
      { name: 'Feed & Inventory', description: 'Tier 2 – feed management' },
      { name: 'Compliance', description: 'Tier 2 – compliance documents' },
      { name: 'Financial', description: 'Tier 2 – financial analytics' },
      { name: 'Alerts', description: 'Tier 2 – smart alert rules' },
      { name: 'Disease AI', description: 'Tier 3 – disease prediction' },
      { name: 'Genomics', description: 'Tier 3 – genomic lineage' },
      { name: 'IoT', description: 'Tier 3 – IoT sensors' },
      { name: 'Supply Chain', description: 'Tier 3 – supply chain traceability' },
      { name: 'Workforce', description: 'Tier 3 – workforce management' },
      { name: 'Reports', description: 'Tier 3 – report builder' },
      { name: 'AI Copilot', description: 'Tier 4 – AI assistant' },
      { name: 'Digital Twin', description: 'Tier 4 – digital twin simulations' },
      { name: 'Marketplace', description: 'Tier 4 – marketplace listings & orders' },
      { name: 'Sustainability', description: 'Tier 4 – sustainability metrics' },
      { name: 'Wellness', description: 'Tier 4 – wellness portal' },
      { name: 'Geospatial', description: 'Tier 4 – geospatial & geofencing' },
      { name: 'Files', description: 'File upload & management' },
      { name: 'System', description: 'Health checks, feature flags, public settings' },
    ],
    paths: {
      // ── Auth ──
      '/auth/register': {
        post: { tags: ['Auth'], summary: 'Register a new user', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'phone', 'role'], properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, confirmPassword: { type: 'string' }, phone: { type: 'string' }, role: { type: 'string' } } } } } }, responses: { '201': { description: 'User created' }, '400': { description: 'Validation error' } } },
      },
      '/auth/login': {
        post: { tags: ['Auth'], summary: 'Login', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { '200': { description: 'JWT token pair' }, '401': { description: 'Invalid credentials' } } },
      },
      '/auth/refresh': {
        post: { tags: ['Auth'], summary: 'Refresh access token', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } } }, responses: { '200': { description: 'New token pair' } } },
      },
      '/auth/logout': {
        post: { tags: ['Auth'], summary: 'Logout (revoke refresh token)', responses: { '200': { description: 'Logged out' } } },
      },
      '/auth/me': {
        get: { tags: ['Auth'], summary: 'Get current user profile', responses: { '200': { description: 'User profile' } } },
      },

      // ── Users ──
      '/users': {
        get: { tags: ['Users'], summary: 'List all users (admin)', responses: { '200': { description: 'User list' } } },
      },
      '/users/{id}': {
        get: { tags: ['Users'], summary: 'Get user by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User details' } } },
      },

      // ── Consultations ──
      '/consultations': {
        get: { tags: ['Consultations'], summary: 'List consultations', responses: { '200': { description: 'Consultation list' } } },
        post: { tags: ['Consultations'], summary: 'Create consultation', responses: { '201': { description: 'Created' } } },
      },
      '/consultations/{id}': {
        get: { tags: ['Consultations'], summary: 'Get consultation by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Consultation details' } } },
        put: { tags: ['Consultations'], summary: 'Update consultation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/consultations/{id}/complete': {
        post: { tags: ['Consultations'], summary: 'Complete a consultation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Completed' } } },
      },
      '/consultations/{id}/cancel': {
        post: { tags: ['Consultations'], summary: 'Cancel a consultation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Cancelled' } } },
      },

      // ── Bookings ──
      '/bookings': {
        get: { tags: ['Bookings'], summary: 'List bookings', responses: { '200': { description: 'Booking list' } } },
        post: { tags: ['Bookings'], summary: 'Create a booking', responses: { '201': { description: 'Booking created' } } },
      },
      '/bookings/{id}': {
        get: { tags: ['Bookings'], summary: 'Get booking', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Booking details' } } },
      },
      '/bookings/{id}/reschedule': {
        put: { tags: ['Bookings'], summary: 'Reschedule booking', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Rescheduled' } } },
      },
      '/bookings/{id}/cancel': {
        post: { tags: ['Bookings'], summary: 'Cancel booking', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Cancelled' } } },
      },
      '/bookings/{id}/confirm': {
        post: { tags: ['Bookings'], summary: 'Confirm booking (vet)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Confirmed' } } },
      },

      // ── Video Sessions ──
      '/video-sessions': {
        post: { tags: ['Video'], summary: 'Create video session', responses: { '201': { description: 'Session created' } } },
      },
      '/video-sessions/{id}': {
        get: { tags: ['Video'], summary: 'Get video session', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Session details' } } },
      },
      '/video-sessions/{id}/end': {
        post: { tags: ['Video'], summary: 'End video session', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Ended' } } },
      },
      '/video-sessions/{id}/messages': {
        get: { tags: ['Video'], summary: 'Get session messages', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Messages' } } },
        post: { tags: ['Video'], summary: 'Send message in session', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Sent' } } },
      },

      // ── Schedule ──
      '/schedules': {
        get: { tags: ['Schedule'], summary: 'List vet schedules', responses: { '200': { description: 'Schedule list' } } },
        post: { tags: ['Schedule'], summary: 'Create schedule slot', responses: { '201': { description: 'Created' } } },
      },
      '/schedules/{id}': {
        put: { tags: ['Schedule'], summary: 'Update schedule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Schedule'], summary: 'Delete schedule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
      },
      '/vets/{vetId}/available-slots': {
        get: { tags: ['Schedule'], summary: 'Get available slots for a vet', parameters: [{ name: 'vetId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Available slots' } } },
      },

      // ── Prescriptions ──
      '/prescriptions': {
        get: { tags: ['Prescriptions'], summary: 'List prescriptions', responses: { '200': { description: 'List' } } },
        post: { tags: ['Prescriptions'], summary: 'Create prescription', responses: { '201': { description: 'Created' } } },
      },
      '/prescriptions/{id}': {
        get: { tags: ['Prescriptions'], summary: 'Get prescription', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Details' } } },
      },

      // ── Animals ──
      '/animals': {
        get: { tags: ['Animals'], summary: 'List animals', responses: { '200': { description: 'Animal list' } } },
        post: { tags: ['Animals'], summary: 'Register an animal', responses: { '201': { description: 'Created' } } },
      },
      '/animals/{id}': {
        get: { tags: ['Animals'], summary: 'Get animal', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Animal details' } } },
        put: { tags: ['Animals'], summary: 'Update animal', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Animals'], summary: 'Delete animal', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
      },

      // ── Vet Profiles ──
      '/vet-profiles': {
        get: { tags: ['Vet Profiles'], summary: 'List vet profiles', responses: { '200': { description: 'List' } } },
        post: { tags: ['Vet Profiles'], summary: 'Create vet profile', responses: { '201': { description: 'Created' } } },
      },
      '/vet-profiles/{id}': {
        get: { tags: ['Vet Profiles'], summary: 'Get vet profile', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Details' } } },
        put: { tags: ['Vet Profiles'], summary: 'Update vet profile', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },

      // ── Medical Records ──
      '/medical-records': {
        get: { tags: ['Medical Records'], summary: 'List medical records', responses: { '200': { description: 'List' } } },
        post: { tags: ['Medical Records'], summary: 'Create record', responses: { '201': { description: 'Created' } } },
      },
      '/medical-records/{id}': {
        get: { tags: ['Medical Records'], summary: 'Get record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Details' } } },
        put: { tags: ['Medical Records'], summary: 'Update record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Medical Records'], summary: 'Delete record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
      },
      '/medical-records/animal/{animalId}/timeline': {
        get: { tags: ['Medical Records'], summary: 'Get health timeline for animal', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Timeline' } } },
      },
      '/vaccinations': {
        get: { tags: ['Medical Records'], summary: 'List vaccinations', responses: { '200': { description: 'List' } } },
        post: { tags: ['Medical Records'], summary: 'Create vaccination', responses: { '201': { description: 'Created' } } },
      },
      '/vaccinations/{id}': {
        put: { tags: ['Medical Records'], summary: 'Update vaccination', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/animals/{animalId}/weight': {
        post: { tags: ['Medical Records'], summary: 'Add weight record', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
        get: { tags: ['Medical Records'], summary: 'Get weight history', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'History' } } },
      },
      '/animals/{animalId}/allergies': {
        get: { tags: ['Medical Records'], summary: 'List allergies', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Medical Records'], summary: 'Add allergy', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/allergies/{id}': {
        put: { tags: ['Medical Records'], summary: 'Update allergy', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/animals/{animalId}/lab-results': {
        get: { tags: ['Medical Records'], summary: 'List lab results', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Medical Records'], summary: 'Add lab result', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/lab-results/{id}': {
        put: { tags: ['Medical Records'], summary: 'Update lab result', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },

      // ── Notifications ──
      '/notifications': {
        get: { tags: ['Notifications'], summary: 'List notifications', responses: { '200': { description: 'List' } } },
      },
      '/notifications/{id}/read': {
        put: { tags: ['Notifications'], summary: 'Mark as read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Marked' } } },
      },
      '/notifications/read-all': {
        put: { tags: ['Notifications'], summary: 'Mark all as read', responses: { '200': { description: 'Done' } } },
      },

      // ── Payments ──
      '/payments': {
        get: { tags: ['Payments'], summary: 'List payments', responses: { '200': { description: 'List' } } },
        post: { tags: ['Payments'], summary: 'Create payment', responses: { '201': { description: 'Created' } } },
      },
      '/payments/{id}': {
        get: { tags: ['Payments'], summary: 'Get payment', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Details' } } },
      },

      // ── Reviews ──
      '/reviews': {
        get: { tags: ['Reviews'], summary: 'List reviews', responses: { '200': { description: 'List' } } },
        post: { tags: ['Reviews'], summary: 'Create review', responses: { '201': { description: 'Created' } } },
      },
      '/reviews/vet/{vetId}': {
        get: { tags: ['Reviews'], summary: 'Get reviews for a vet', parameters: [{ name: 'vetId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
      },

      // ── Admin ──
      '/admin/stats': {
        get: { tags: ['Admin'], summary: 'Dashboard statistics', responses: { '200': { description: 'Stats' } } },
      },
      '/admin/users': {
        get: { tags: ['Admin'], summary: 'List all users (admin)', responses: { '200': { description: 'Users' } } },
      },
      '/admin/users/{id}/toggle-status': {
        put: { tags: ['Admin'], summary: 'Enable/disable user', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Toggled' } } },
      },
      '/admin/users/{id}/role': {
        put: { tags: ['Admin'], summary: 'Change user role', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Changed' } } },
      },
      '/admin/consultations': {
        get: { tags: ['Admin'], summary: 'List consultations (admin)', responses: { '200': { description: 'List' } } },
      },
      '/admin/payments': {
        get: { tags: ['Admin'], summary: 'List payments (admin)', responses: { '200': { description: 'List' } } },
      },
      '/admin/payments/{id}/refund': {
        post: { tags: ['Admin'], summary: 'Process refund', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Refunded' } } },
      },
      '/admin/reviews': {
        get: { tags: ['Admin'], summary: 'List reviews (admin)', responses: { '200': { description: 'List' } } },
      },
      '/admin/reviews/{id}/moderate': {
        put: { tags: ['Admin'], summary: 'Moderate a review', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Moderated' } } },
      },
      '/admin/settings': {
        get: { tags: ['Admin'], summary: 'Get system settings', responses: { '200': { description: 'Settings' } } },
      },
      '/admin/settings/{key}': {
        put: { tags: ['Admin'], summary: 'Update setting', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/admin/medical-records': {
        get: { tags: ['Admin'], summary: 'List medical records (admin)', responses: { '200': { description: 'List' } } },
      },
      '/admin/audit-logs': {
        get: { tags: ['Admin'], summary: 'List audit logs', responses: { '200': { description: 'Logs' } } },
      },
      '/admin/permissions': {
        get: { tags: ['Admin'], summary: 'List all permissions', responses: { '200': { description: 'Permissions' } } },
      },
      '/admin/permissions/{id}': {
        put: { tags: ['Admin'], summary: 'Update permission', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/admin/permissions/bulk-update': {
        put: { tags: ['Admin'], summary: 'Bulk update permissions', responses: { '200': { description: 'Updated' } } },
      },
      '/admin/permissions/reset': {
        post: { tags: ['Admin'], summary: 'Reset permissions to defaults', responses: { '200': { description: 'Reset' } } },
      },

      // ── Enterprise ──
      '/enterprises': {
        get: { tags: ['Enterprise'], summary: 'List enterprises', responses: { '200': { description: 'List' } } },
        post: { tags: ['Enterprise'], summary: 'Create enterprise', responses: { '201': { description: 'Created' } } },
      },
      '/enterprises/{id}': {
        get: { tags: ['Enterprise'], summary: 'Get enterprise', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Details' } } },
        put: { tags: ['Enterprise'], summary: 'Update enterprise', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/enterprises/{id}/members': {
        get: { tags: ['Enterprise'], summary: 'List members', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Members' } } },
        post: { tags: ['Enterprise'], summary: 'Add member', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Added' } } },
      },
      '/enterprises/{id}/members/{memberId}': {
        put: { tags: ['Enterprise'], summary: 'Update member', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Enterprise'], summary: 'Remove member', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Removed' } } },
      },

      // ── Animal Groups ──
      '/enterprises/{enterpriseId}/animal-groups': {
        get: { tags: ['Enterprise'], summary: 'List animal groups', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Enterprise'], summary: 'Create animal group', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/animal-groups/{id}': {
        put: { tags: ['Enterprise'], summary: 'Update group', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Enterprise'], summary: 'Delete group', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
      },
      '/animal-groups/{groupId}/animals': {
        post: { tags: ['Enterprise'], summary: 'Assign animal to group', parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Assigned' } } },
        delete: { tags: ['Enterprise'], summary: 'Remove animal from group', parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Removed' } } },
      },

      // ── Locations & Movements ──
      '/enterprises/{enterpriseId}/locations': {
        get: { tags: ['Enterprise'], summary: 'List locations', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Enterprise'], summary: 'Create location', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/locations/{id}': {
        put: { tags: ['Enterprise'], summary: 'Update location', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
        delete: { tags: ['Enterprise'], summary: 'Delete location', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
      },
      '/enterprises/{enterpriseId}/movements': {
        get: { tags: ['Enterprise'], summary: 'List movements', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Enterprise'], summary: 'Create movement', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },

      // ── Campaigns ──
      '/enterprises/{enterpriseId}/campaigns': {
        get: { tags: ['Enterprise'], summary: 'List campaigns', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Enterprise'], summary: 'Create campaign', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/campaigns/{id}': {
        put: { tags: ['Enterprise'], summary: 'Update campaign', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/campaigns/{id}/execute': {
        post: { tags: ['Enterprise'], summary: 'Execute campaign', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Executed' } } },
      },

      // ── Files ──
      '/files/upload': {
        post: { tags: ['Files'], summary: 'Upload single file', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, folder: { type: 'string' } } } } } }, responses: { '201': { description: 'Uploaded', content: { 'application/json': { schema: { $ref: '#/components/schemas/StoredFile' } } } } } },
      },
      '/files/upload-multiple': {
        post: { tags: ['Files'], summary: 'Upload multiple files (max 10)', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, folder: { type: 'string' } } } } } }, responses: { '201': { description: 'Uploaded' } } },
      },
      '/files': {
        get: { tags: ['Files'], summary: 'List uploaded files', parameters: [{ name: 'folder', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'File list' } } },
      },

      // ── System ──
      '/health': {
        get: { tags: ['System'], summary: 'Health check', security: [], responses: { '200': { description: 'OK' } } },
      },
      '/features': {
        get: { tags: ['System'], summary: 'Feature flags', security: [], responses: { '200': { description: 'Flags' } } },
      },
      '/settings/public': {
        get: { tags: ['System'], summary: 'Public settings', security: [], responses: { '200': { description: 'Settings' } } },
      },

      // ── Tier 2: Health Analytics ──
      '/enterprises/{enterpriseId}/health/observations': {
        get: { tags: ['Health Analytics'], summary: 'List health observations', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Health Analytics'], summary: 'Create observation', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/health/observations/{id}/resolve': {
        put: { tags: ['Health Analytics'], summary: 'Resolve observation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Resolved' } } },
      },
      '/enterprises/{enterpriseId}/health/analytics': {
        get: { tags: ['Health Analytics'], summary: 'Health analytics summary', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Analytics' } } },
      },

      // ── Tier 2: Breeding ──
      '/enterprises/{enterpriseId}/breeding/records': {
        get: { tags: ['Breeding'], summary: 'List breeding records', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Breeding'], summary: 'Create breeding record', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/breeding/records/{id}': {
        put: { tags: ['Breeding'], summary: 'Update breeding record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },

      // ── Tier 2: Feed ──
      '/enterprises/{enterpriseId}/feed': {
        get: { tags: ['Feed & Inventory'], summary: 'List feed items', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Feed & Inventory'], summary: 'Create feed item', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/feed/{id}': {
        put: { tags: ['Feed & Inventory'], summary: 'Update feed item', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/feed/{id}/restock': {
        post: { tags: ['Feed & Inventory'], summary: 'Restock feed', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Restocked' } } },
      },
      '/feed/{id}/consumption': {
        post: { tags: ['Feed & Inventory'], summary: 'Log consumption', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Logged' } } },
      },

      // ── Tier 2: Compliance ──
      '/enterprises/{enterpriseId}/compliance': {
        get: { tags: ['Compliance'], summary: 'List compliance docs', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Compliance'], summary: 'Create compliance doc', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/compliance/{id}': {
        put: { tags: ['Compliance'], summary: 'Update compliance doc', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },

      // ── Tier 2: Financial ──
      '/enterprises/{enterpriseId}/financial/records': {
        get: { tags: ['Financial'], summary: 'List financial records', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Financial'], summary: 'Create financial record', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/financial/records/{id}': {
        put: { tags: ['Financial'], summary: 'Update financial record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/enterprises/{enterpriseId}/financial/analytics': {
        get: { tags: ['Financial'], summary: 'Financial analytics', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Analytics' } } },
      },

      // ── Tier 2: Alerts ──
      '/enterprises/{enterpriseId}/alerts/rules': {
        get: { tags: ['Alerts'], summary: 'List alert rules', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Alerts'], summary: 'Create alert rule', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/alerts/rules/{id}': {
        put: { tags: ['Alerts'], summary: 'Update alert rule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/alerts/rules/{id}/toggle': {
        put: { tags: ['Alerts'], summary: 'Toggle alert rule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Toggled' } } },
      },
      '/enterprises/{enterpriseId}/alerts/active': {
        get: { tags: ['Alerts'], summary: 'List active alerts', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Active alerts' } } },
      },

      // ── Tier 3: Disease AI ──
      '/enterprises/{enterpriseId}/predictions': {
        get: { tags: ['Disease AI'], summary: 'List predictions', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Disease AI'], summary: 'Create prediction', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/predictions/{id}/resolve': {
        put: { tags: ['Disease AI'], summary: 'Resolve prediction', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Resolved' } } },
      },
      '/enterprises/{enterpriseId}/outbreak-zones': {
        get: { tags: ['Disease AI'], summary: 'List outbreak zones', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Zones' } } },
        post: { tags: ['Disease AI'], summary: 'Create outbreak zone', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },

      // ── Tier 3: Genomics ──
      '/animals/{animalId}/genetic-profile': {
        get: { tags: ['Genomics'], summary: 'Get genetic profile', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Profile' } } },
        post: { tags: ['Genomics'], summary: 'Create genetic profile', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
        put: { tags: ['Genomics'], summary: 'Update genetic profile', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/genomics/pair-recommendation': {
        post: { tags: ['Genomics'], summary: 'Get pair recommendation', responses: { '200': { description: 'Recommendation' } } },
      },
      '/animals/{animalId}/lineage': {
        get: { tags: ['Genomics'], summary: 'Get lineage tree', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Lineage' } } },
      },

      // ── Tier 3: IoT ──
      '/enterprises/{enterpriseId}/sensors': {
        get: { tags: ['IoT'], summary: 'List sensors', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['IoT'], summary: 'Create sensor', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/sensors/{id}': {
        put: { tags: ['IoT'], summary: 'Update sensor', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/sensors/{id}/readings': {
        post: { tags: ['IoT'], summary: 'Record sensor reading', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Recorded' } } },
        get: { tags: ['IoT'], summary: 'List sensor readings', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Readings' } } },
      },

      // ── Tier 3: Supply Chain ──
      '/enterprises/{enterpriseId}/supply-chain/batches': {
        get: { tags: ['Supply Chain'], summary: 'List batches', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Supply Chain'], summary: 'Create batch', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/supply-chain/batches/{id}': {
        put: { tags: ['Supply Chain'], summary: 'Update batch', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/supply-chain/batches/{id}/events': {
        post: { tags: ['Supply Chain'], summary: 'Add traceability event', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
        get: { tags: ['Supply Chain'], summary: 'Get batch events', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Events' } } },
      },
      '/supply-chain/batches/{id}/qr': {
        post: { tags: ['Supply Chain'], summary: 'Generate QR code', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'QR data' } } },
      },

      // ── Tier 3: Workforce ──
      '/enterprises/{enterpriseId}/workforce/tasks': {
        get: { tags: ['Workforce'], summary: 'List tasks', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Workforce'], summary: 'Create task', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/workforce/tasks/{id}': {
        put: { tags: ['Workforce'], summary: 'Update task', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/enterprises/{enterpriseId}/workforce/shifts': {
        get: { tags: ['Workforce'], summary: 'List shifts', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List' } } },
        post: { tags: ['Workforce'], summary: 'Create shift', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/workforce/shifts/{id}': {
        put: { tags: ['Workforce'], summary: 'Update shift', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },

      // ── Tier 3: Reports ──
      '/report-templates': {
        get: { tags: ['Reports'], summary: 'List report templates', responses: { '200': { description: 'List' } } },
        post: { tags: ['Reports'], summary: 'Create report template', responses: { '201': { description: 'Created' } } },
      },
      '/report-templates/{id}': {
        put: { tags: ['Reports'], summary: 'Update template', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/reports/generate': {
        post: { tags: ['Reports'], summary: 'Generate report', responses: { '200': { description: 'Report data' } } },
      },
      '/reports': {
        get: { tags: ['Reports'], summary: 'List generated reports', responses: { '200': { description: 'List' } } },
      },

      // ── Tier 4: AI Copilot ──
      '/ai/chat/sessions': {
        post: { tags: ['AI Copilot'], summary: 'Create chat session', responses: { '201': { description: 'Session' } } },
        get: { tags: ['AI Copilot'], summary: 'List chat sessions', responses: { '200': { description: 'Sessions' } } },
      },
      '/ai/chat/sessions/{sessionId}/messages': {
        post: { tags: ['AI Copilot'], summary: 'Send message', parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Response' } } },
        get: { tags: ['AI Copilot'], summary: 'Get session messages', parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Messages' } } },
      },
      '/ai/drug-interactions': {
        post: { tags: ['AI Copilot'], summary: 'Check drug interactions', responses: { '200': { description: 'Result' } } },
      },
      '/ai/symptom-analysis': {
        post: { tags: ['AI Copilot'], summary: 'Analyze symptoms', responses: { '200': { description: 'Analysis' } } },
      },

      // ── Tier 4: Digital Twin ──
      '/animals/{animalId}/digital-twin': {
        get: { tags: ['Digital Twin'], summary: 'Get digital twin', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Twin data' } } },
        post: { tags: ['Digital Twin'], summary: 'Create digital twin', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
        put: { tags: ['Digital Twin'], summary: 'Update digital twin', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/digital-twin/{twinId}/simulate': {
        post: { tags: ['Digital Twin'], summary: 'Run simulation', parameters: [{ name: 'twinId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Simulation result' } } },
      },
      '/digital-twin/{twinId}/simulations': {
        get: { tags: ['Digital Twin'], summary: 'List simulations', parameters: [{ name: 'twinId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Simulations' } } },
      },

      // ── Tier 4: Marketplace ──
      '/marketplace/listings': {
        get: { tags: ['Marketplace'], summary: 'List marketplace listings', responses: { '200': { description: 'Listings' } } },
        post: { tags: ['Marketplace'], summary: 'Create listing', responses: { '201': { description: 'Created' } } },
      },
      '/marketplace/listings/{id}': {
        get: { tags: ['Marketplace'], summary: 'Get listing', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Details' } } },
        put: { tags: ['Marketplace'], summary: 'Update listing', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/marketplace/listings/{id}/bids': {
        post: { tags: ['Marketplace'], summary: 'Place bid', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Bid placed' } } },
        get: { tags: ['Marketplace'], summary: 'List bids', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Bids' } } },
      },
      '/marketplace/orders': {
        post: { tags: ['Marketplace'], summary: 'Create order', responses: { '201': { description: 'Order created' } } },
        get: { tags: ['Marketplace'], summary: 'List orders', responses: { '200': { description: 'Orders' } } },
      },
      '/marketplace/orders/{id}/status': {
        put: { tags: ['Marketplace'], summary: 'Update order status', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },

      // ── Tier 4: Sustainability ──
      '/enterprises/{enterpriseId}/sustainability/metrics': {
        get: { tags: ['Sustainability'], summary: 'List sustainability metrics', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Metrics' } } },
        post: { tags: ['Sustainability'], summary: 'Create metric', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/sustainability/metrics/{id}': {
        put: { tags: ['Sustainability'], summary: 'Update metric', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/enterprises/{enterpriseId}/sustainability/goals': {
        get: { tags: ['Sustainability'], summary: 'List goals', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Goals' } } },
        post: { tags: ['Sustainability'], summary: 'Create goal', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/sustainability/goals/{id}': {
        put: { tags: ['Sustainability'], summary: 'Update goal', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/enterprises/{enterpriseId}/sustainability/dashboard': {
        get: { tags: ['Sustainability'], summary: 'Sustainability dashboard', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Dashboard' } } },
      },

      // ── Tier 4: Wellness ──
      '/animals/{animalId}/wellness/scorecard': {
        get: { tags: ['Wellness'], summary: 'Get wellness scorecard', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Scorecard' } } },
        post: { tags: ['Wellness'], summary: 'Create scorecard', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
        put: { tags: ['Wellness'], summary: 'Update scorecard', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/wellness/reminders': {
        get: { tags: ['Wellness'], summary: 'List reminders', responses: { '200': { description: 'Reminders' } } },
        post: { tags: ['Wellness'], summary: 'Create reminder', responses: { '201': { description: 'Created' } } },
      },
      '/wellness/reminders/{id}/snooze': {
        put: { tags: ['Wellness'], summary: 'Snooze reminder', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Snoozed' } } },
      },
      '/wellness/reminders/{id}/complete': {
        put: { tags: ['Wellness'], summary: 'Complete reminder', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Completed' } } },
      },
      '/wellness/community/tips': {
        get: { tags: ['Wellness'], summary: 'Community wellness tips', responses: { '200': { description: 'Tips' } } },
      },

      // ── Tier 4: Geospatial ──
      '/enterprises/{enterpriseId}/geospatial/zones': {
        get: { tags: ['Geospatial'], summary: 'List geofence zones', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Zones' } } },
        post: { tags: ['Geospatial'], summary: 'Create geofence zone', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/geospatial/zones/{id}': {
        put: { tags: ['Geospatial'], summary: 'Update zone', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      },
      '/enterprises/{enterpriseId}/geospatial/events': {
        post: { tags: ['Geospatial'], summary: 'Create geospatial event', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } },
      },
      '/enterprises/{enterpriseId}/geospatial/heatmap': {
        get: { tags: ['Geospatial'], summary: 'Get heatmap data', parameters: [{ name: 'enterpriseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Heatmap' } } },
      },
      '/geospatial/animals/{animalId}/trail': {
        get: { tags: ['Geospatial'], summary: 'Get animal movement trail', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Trail' } } },
      },
    },
  },
  apis: [], // We're defining paths inline, no JSDoc to scan
};

export const swaggerSpec = swaggerJsdoc(options);
