import {
  cancelBookingSchema, createVideoSessionSchema, endVideoSessionSchema, sendVideoMessageSchema,
  createScheduleSchema, updateScheduleSchema, createAnimalSchema, updateAnimalSchema,
  createVetProfileSchema, updateVetProfileSchema, createMedicalRecordSchema, updateMedicalRecordSchema,
  deleteMedicalRecordSchema, createVaccinationSchema, addWeightSchema, createAllergySchema,
  createLabResultSchema, createPaymentSchema, toggleUserStatusSchema, changeUserRoleSchema,
  processRefundSchema, moderateReviewSchema, updateSystemSettingSchema, updatePermissionSchema,
  bulkUpdatePermissionsSchema, resetPermissionsSchema, createEnterpriseSchema, addMemberSchema,
  updateMemberSchema, createAnimalGroupSchema, assignAnimalToGroupSchema, createLocationSchema,
  createMovementSchema, createCampaignSchema, createObservationSchema, resolveObservationSchema,
  createBreedingRecordSchema, updateBreedingRecordSchema, createFeedSchema, restockFeedSchema,
  logFeedConsumptionSchema, createComplianceDocSchema, updateComplianceDocSchema,
  createFinancialRecordSchema, updateFinancialRecordSchema, createAlertRuleSchema, updateAlertRuleSchema,
  toggleAlertRuleSchema, createPredictionSchema, resolvePredictionSchema, createOutbreakZoneSchema,
  createGeneticProfileSchema, updateGeneticProfileSchema, createPairRecommendationSchema,
  createSensorSchema, updateSensorSchema, recordSensorReadingSchema, createBatchSchema,
  updateBatchSchema, createTraceabilityEventSchema, generateQRCodeSchema, createTaskSchema,
  updateTaskSchema, createShiftSchema, updateShiftSchema, createReportTemplateSchema,
  updateReportTemplateSchema, generateReportSchema, createChatSessionSchema, sendChatMessageSchema,
  checkDrugInteractionsSchema, analyzeSymptomsSchema, createDigitalTwinSchema, updateDigitalTwinSchema,
  runSimulationSchema, createMarketplaceListingSchema, updateMarketplaceListingSchema, placeBidSchema,
  createMarketplaceOrderSchema, updateOrderStatusSchema, createSustainabilityMetricSchema,
  updateSustainabilityMetricSchema, createSustainabilityGoalSchema, updateSustainabilityGoalSchema,
  createWellnessScorecardSchema, updateWellnessScorecardSchema, createWellnessReminderSchema,
  snoozeReminderSchema, createGeofenceZoneSchema, updateGeofenceZoneSchema,
  createGeospatialEventSchema, paginationSchema, createHospitalSchema, updateHospitalSchema,
  addHospitalDoctorSchema, updateHospitalDoctorSchema, createDepartmentSchema,
  createHospitalServiceSchema, verifyHospitalSchema, uploadHospitalDocSchema, reviewHospitalDocSchema,
} from '../../src/middleware/validation';

const u = '550e8400-e29b-41d4-a716-446655440000';

describe('Extended Validation Schemas', () => {

  describe('cancelBookingSchema', () => {
    it('accepts valid', () => { expect(cancelBookingSchema.validate({ reason: 'Conflict' }).error).toBeUndefined(); });
    it('accepts empty', () => { expect(cancelBookingSchema.validate({}).error).toBeUndefined(); });
  });

  describe('createVideoSessionSchema', () => {
    it('accepts valid', () => { expect(createVideoSessionSchema.validate({ consultationId: u, participantUserId: u }).error).toBeUndefined(); });
    it('rejects bad uuid', () => { expect(createVideoSessionSchema.validate({ consultationId: 'bad', participantUserId: u }).error).toBeDefined(); });
  });

  describe('endVideoSessionSchema', () => {
    it('accepts valid', () => { expect(endVideoSessionSchema.validate({ recordingUrl: 'https://example.com/rec' }).error).toBeUndefined(); });
  });

  describe('sendVideoMessageSchema', () => {
    it('accepts text', () => { expect(sendVideoMessageSchema.validate({ message: 'Hello', messageType: 'text' }).error).toBeUndefined(); });
    it('rejects missing message', () => { expect(sendVideoMessageSchema.validate({ messageType: 'text' }).error).toBeDefined(); });
  });

  describe('createScheduleSchema', () => {
    it('accepts valid', () => { expect(createScheduleSchema.validate({ dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00' }).error).toBeUndefined(); });
    it('rejects invalid day', () => { expect(createScheduleSchema.validate({ dayOfWeek: 'funday', startTime: '09:00', endTime: '17:00' }).error).toBeDefined(); });
  });

  describe('updateScheduleSchema', () => {
    it('accepts partial', () => { expect(updateScheduleSchema.validate({ slotDuration: 15 }).error).toBeUndefined(); });
  });

  describe('updateAnimalSchema', () => {
    it('accepts partial', () => { expect(updateAnimalSchema.validate({ name: 'Buddy' }).error).toBeUndefined(); });
  });

  describe('createVetProfileSchema', () => {
    it('accepts valid', () => { expect(createVetProfileSchema.validate({ licenseNumber: 'VET-001', yearsOfExperience: 5, consultationFee: 50 }).error).toBeUndefined(); });
    it('rejects missing licenseNumber', () => { expect(createVetProfileSchema.validate({ yearsOfExperience: 5 }).error).toBeDefined(); });
  });

  describe('updateVetProfileSchema', () => {
    it('accepts partial', () => { expect(updateVetProfileSchema.validate({ consultationFee: 75 }).error).toBeUndefined(); });
  });

  describe('createMedicalRecordSchema', () => {
    it('accepts valid', () => { expect(createMedicalRecordSchema.validate({ animalId: u, recordType: 'other', title: 'Checkup', content: 'Healthy' }).error).toBeUndefined(); });
    it('rejects missing title', () => { expect(createMedicalRecordSchema.validate({ recordType: 'other', content: 'text' }).error).toBeDefined(); });
  });

  describe('updateMedicalRecordSchema', () => {
    it('accepts partial', () => { expect(updateMedicalRecordSchema.validate({ content: 'Updated' }).error).toBeUndefined(); });
  });

  describe('deleteMedicalRecordSchema', () => {
    it('accepts reason', () => { expect(deleteMedicalRecordSchema.validate({ reason: 'Duplicate' }).error).toBeUndefined(); });
  });

  describe('createVaccinationSchema', () => {
    it('accepts valid', () => { expect(createVaccinationSchema.validate({ animalId: u, vaccineName: 'Rabies', dateAdministered: '2024-06-01' }).error).toBeUndefined(); });
    it('rejects missing vaccineName', () => { expect(createVaccinationSchema.validate({ animalId: u, dateAdministered: '2024-06-01' }).error).toBeDefined(); });
  });

  describe('addWeightSchema', () => {
    it('accepts valid', () => { expect(addWeightSchema.validate({ animalId: u, weight: 25.5, unit: 'kg' }).error).toBeUndefined(); });
    it('rejects negative', () => { expect(addWeightSchema.validate({ animalId: u, weight: -5, unit: 'kg' }).error).toBeDefined(); });
  });

  describe('createAllergySchema', () => {
    it('accepts valid', () => { expect(createAllergySchema.validate({ animalId: u, allergen: 'Pollen', severity: 'mild' }).error).toBeUndefined(); });
  });

  describe('createLabResultSchema', () => {
    it('accepts valid', () => { expect(createLabResultSchema.validate({ animalId: u, testName: 'CBC', testDate: '2024-06-01' }).error).toBeUndefined(); });
  });

  describe('createPaymentSchema', () => {
    it('accepts valid', () => { expect(createPaymentSchema.validate({ consultationId: u, amount: 50 }).error).toBeUndefined(); });
    it('rejects missing amount', () => { expect(createPaymentSchema.validate({ consultationId: u }).error).toBeDefined(); });
  });

  describe('toggleUserStatusSchema', () => {
    it('accepts valid', () => { expect(toggleUserStatusSchema.validate({ isActive: false }).error).toBeUndefined(); });
  });

  describe('changeUserRoleSchema', () => {
    it('accepts valid', () => { expect(changeUserRoleSchema.validate({ role: 'veterinarian' }).error).toBeUndefined(); });
  });

  describe('processRefundSchema', () => {
    it('accepts valid', () => { expect(processRefundSchema.validate({ amount: 50, reason: 'Cancelled' }).error).toBeUndefined(); });
  });

  describe('moderateReviewSchema', () => {
    it('accepts valid', () => { expect(moderateReviewSchema.validate({ action: 'approve' }).error).toBeUndefined(); });
  });

  describe('updateSystemSettingSchema', () => {
    it('accepts valid', () => { expect(updateSystemSettingSchema.validate({ key: 'site_name', value: 'VetCare' }).error).toBeUndefined(); });
  });

  describe('updatePermissionSchema', () => {
    it('accepts valid', () => { expect(updatePermissionSchema.validate({ role: 'pet_owner', permission: 'view_dashboard', isEnabled: true }).error).toBeUndefined(); });
  });

  describe('bulkUpdatePermissionsSchema', () => {
    it('accepts valid', () => { expect(bulkUpdatePermissionsSchema.validate({ role: 'pet_owner', permissions: { view_dashboard: true } }).error).toBeUndefined(); });
  });

  describe('resetPermissionsSchema', () => {
    it('accepts valid', () => { expect(resetPermissionsSchema.validate({ role: 'pet_owner' }).error).toBeUndefined(); });
  });

  describe('createEnterpriseSchema', () => {
    it('accepts valid', () => { expect(createEnterpriseSchema.validate({ name: 'My Farm', enterpriseType: 'dairy' }).error).toBeUndefined(); });
    it('rejects missing name', () => { expect(createEnterpriseSchema.validate({ enterpriseType: 'dairy' }).error).toBeDefined(); });
  });

  describe('addMemberSchema', () => {
    it('accepts valid', () => { expect(addMemberSchema.validate({ userId: u, role: 'manager' }).error).toBeUndefined(); });
  });

  describe('updateMemberSchema', () => {
    it('accepts valid', () => { expect(updateMemberSchema.validate({ role: 'admin' }).error).toBeUndefined(); });
  });

  describe('createAnimalGroupSchema', () => {
    it('accepts valid', () => { expect(createAnimalGroupSchema.validate({ enterpriseId: u, name: 'Herd A', groupType: 'herd' }).error).toBeUndefined(); });
  });

  describe('assignAnimalToGroupSchema', () => {
    it('accepts valid', () => { expect(assignAnimalToGroupSchema.validate({ animalId: u }).error).toBeUndefined(); });
  });

  describe('createLocationSchema', () => {
    it('accepts valid', () => { expect(createLocationSchema.validate({ enterpriseId: u, name: 'Barn A', locationType: 'barn' }).error).toBeUndefined(); });
  });

  describe('createMovementSchema', () => {
    it('accepts valid', () => { expect(createMovementSchema.validate({ enterpriseId: u, animalId: u, movementType: 'transfer' }).error).toBeUndefined(); });
  });

  describe('createCampaignSchema', () => {
    it('accepts valid', () => { expect(createCampaignSchema.validate({ enterpriseId: u, name: 'Deworming', campaignType: 'deworming', scheduledDate: '2024-07-01' }).error).toBeUndefined(); });
  });

  describe('createObservationSchema', () => {
    it('accepts valid', () => { expect(createObservationSchema.validate({ enterpriseId: u, title: 'Limping', observationType: 'symptom', severity: 'medium' }).error).toBeUndefined(); });
  });

  describe('resolveObservationSchema', () => {
    it('accepts valid', () => { expect(resolveObservationSchema.validate({ outcome: 'Treated' }).error).toBeUndefined(); });
  });

  describe('createBreedingRecordSchema', () => {
    it('accepts valid', () => { expect(createBreedingRecordSchema.validate({ enterpriseId: u, breedingDate: '2024-06-01' }).error).toBeUndefined(); });
  });

  describe('updateBreedingRecordSchema', () => {
    it('accepts partial', () => { expect(updateBreedingRecordSchema.validate({ status: 'confirmed' }).error).toBeUndefined(); });
  });

  describe('createFeedSchema', () => {
    it('accepts valid', () => { expect(createFeedSchema.validate({ enterpriseId: u, feedName: 'Corn', feedType: 'grain' }).error).toBeUndefined(); });
  });

  describe('restockFeedSchema', () => {
    it('accepts valid', () => { expect(restockFeedSchema.validate({ quantity: 100 }).error).toBeUndefined(); });
  });

  describe('logFeedConsumptionSchema', () => {
    it('accepts valid', () => { expect(logFeedConsumptionSchema.validate({ enterpriseId: u, feedId: u, quantity: 10 }).error).toBeUndefined(); });
  });

  describe('createComplianceDocSchema', () => {
    it('accepts valid', () => { expect(createComplianceDocSchema.validate({ enterpriseId: u, documentType: 'license', title: 'Farm License' }).error).toBeUndefined(); });
  });

  describe('updateComplianceDocSchema', () => {
    it('accepts partial', () => { expect(updateComplianceDocSchema.validate({ status: 'verified' }).error).toBeUndefined(); });
  });

  describe('createFinancialRecordSchema', () => {
    it('accepts valid', () => { expect(createFinancialRecordSchema.validate({ enterpriseId: u, recordType: 'income', category: 'milk_sales', amount: 5000 }).error).toBeUndefined(); });
  });

  describe('updateFinancialRecordSchema', () => {
    it('accepts partial', () => { expect(updateFinancialRecordSchema.validate({ amount: 5500 }).error).toBeUndefined(); });
  });

  describe('createAlertRuleSchema', () => {
    it('accepts valid', () => { expect(createAlertRuleSchema.validate({ enterpriseId: u, name: 'Temp Alert', alertType: 'temperature', severity: 'high' }).error).toBeUndefined(); });
  });

  describe('updateAlertRuleSchema', () => {
    it('accepts partial', () => { expect(updateAlertRuleSchema.validate({ severity: 'low' }).error).toBeUndefined(); });
  });

  describe('toggleAlertRuleSchema', () => {
    it('accepts valid', () => { expect(toggleAlertRuleSchema.validate({ isEnabled: false }).error).toBeUndefined(); });
  });

  describe('createPredictionSchema', () => {
    it('accepts valid', () => { expect(createPredictionSchema.validate({ enterpriseId: u, diseaseName: 'Bovine TB', riskScore: 85 }).error).toBeUndefined(); });
  });

  describe('resolvePredictionSchema', () => {
    it('accepts valid', () => { expect(resolvePredictionSchema.validate({ outcome: 'confirmed' }).error).toBeUndefined(); });
  });

  describe('createOutbreakZoneSchema', () => {
    it('accepts valid', () => { expect(createOutbreakZoneSchema.validate({ enterpriseId: u, diseaseName: 'Avian Flu', severity: 'high' }).error).toBeUndefined(); });
  });

  describe('createGeneticProfileSchema', () => {
    it('accepts valid', () => { expect(createGeneticProfileSchema.validate({ enterpriseId: u, animalId: u }).error).toBeUndefined(); });
  });

  describe('updateGeneticProfileSchema', () => {
    it('accepts partial', () => { expect(updateGeneticProfileSchema.validate({ notes: 'Updated' }).error).toBeUndefined(); });
  });

  describe('createPairRecommendationSchema', () => {
    it('accepts valid', () => { expect(createPairRecommendationSchema.validate({ enterpriseId: u, sireId: u, damId: u, compatibilityScore: 92 }).error).toBeUndefined(); });
  });

  describe('createSensorSchema', () => {
    it('accepts valid', () => { expect(createSensorSchema.validate({ enterpriseId: u, sensorName: 'Temp 1', sensorType: 'temperature' }).error).toBeUndefined(); });
  });

  describe('updateSensorSchema', () => {
    it('accepts partial', () => { expect(updateSensorSchema.validate({ status: 'inactive' }).error).toBeUndefined(); });
  });

  describe('recordSensorReadingSchema', () => {
    it('accepts valid', () => { expect(recordSensorReadingSchema.validate({ sensorId: u, enterpriseId: u, value: 25.5 }).error).toBeUndefined(); });
  });

  describe('createBatchSchema', () => {
    it('accepts valid', () => { expect(createBatchSchema.validate({ enterpriseId: u, batchNumber: 'MB-001', productType: 'milk' }).error).toBeUndefined(); });
  });

  describe('updateBatchSchema', () => {
    it('accepts partial', () => { expect(updateBatchSchema.validate({ status: 'shipped' }).error).toBeUndefined(); });
  });

  describe('createTraceabilityEventSchema', () => {
    it('accepts valid', () => { expect(createTraceabilityEventSchema.validate({ enterpriseId: u, eventType: 'quality_check', title: 'QA', description: 'Passed' }).error).toBeUndefined(); });
  });

  describe('generateQRCodeSchema', () => {
    it('accepts valid', () => { expect(generateQRCodeSchema.validate({ enterpriseId: u, entityType: 'batch', entityId: u }).error).toBeUndefined(); });
  });

  describe('createTaskSchema', () => {
    it('accepts valid', () => { expect(createTaskSchema.validate({ enterpriseId: u, title: 'Feed Animals', priority: 'high' }).error).toBeUndefined(); });
  });

  describe('updateTaskSchema', () => {
    it('accepts partial', () => { expect(updateTaskSchema.validate({ status: 'completed' }).error).toBeUndefined(); });
  });

  describe('createShiftSchema', () => {
    it('accepts valid', () => { expect(createShiftSchema.validate({ enterpriseId: u, userId: u, shiftDate: '2024-06-15', startTime: '08:00', endTime: '16:00' }).error).toBeUndefined(); });
  });

  describe('updateShiftSchema', () => {
    it('accepts partial', () => { expect(updateShiftSchema.validate({ endTime: '17:00' }).error).toBeUndefined(); });
  });

  describe('createReportTemplateSchema', () => {
    it('accepts valid', () => { expect(createReportTemplateSchema.validate({ name: 'Census Report', reportType: 'animal_census' }).error).toBeUndefined(); });
  });

  describe('updateReportTemplateSchema', () => {
    it('accepts partial', () => { expect(updateReportTemplateSchema.validate({ name: 'Updated Census' }).error).toBeUndefined(); });
  });

  describe('generateReportSchema', () => {
    it('accepts valid', () => { expect(generateReportSchema.validate({ enterpriseId: u, reportType: 'animal_census' }).error).toBeUndefined(); });
  });

  describe('createChatSessionSchema', () => {
    it('accepts valid', () => { expect(createChatSessionSchema.validate({ title: 'Health Query', contextType: 'pet_care' }).error).toBeUndefined(); });
  });

  describe('sendChatMessageSchema', () => {
    it('accepts valid', () => { expect(sendChatMessageSchema.validate({ content: 'What is parvo?' }).error).toBeUndefined(); });
    it('rejects empty', () => { expect(sendChatMessageSchema.validate({ content: '' }).error).toBeDefined(); });
  });

  describe('checkDrugInteractionsSchema', () => {
    it('accepts valid', () => { expect(checkDrugInteractionsSchema.validate({ drugs: ['Amoxicillin', 'Metronidazole'] }).error).toBeUndefined(); });
  });

  describe('analyzeSymptomsSchema', () => {
    it('accepts valid', () => { expect(analyzeSymptomsSchema.validate({ symptoms: ['vomiting', 'lethargy'], species: 'dog' }).error).toBeUndefined(); });
  });

  describe('createDigitalTwinSchema', () => {
    it('accepts valid', () => { expect(createDigitalTwinSchema.validate({ name: 'Twin 1', twinType: 'animal' }).error).toBeUndefined(); });
  });

  describe('updateDigitalTwinSchema', () => {
    it('accepts partial', () => { expect(updateDigitalTwinSchema.validate({ name: 'Updated Twin' }).error).toBeUndefined(); });
  });

  describe('runSimulationSchema', () => {
    it('accepts valid', () => { expect(runSimulationSchema.validate({ twinId: u, name: 'Sim1', scenarioType: 'growth' }).error).toBeUndefined(); });
  });

  describe('createMarketplaceListingSchema', () => {
    it('accepts valid', () => { expect(createMarketplaceListingSchema.validate({ title: 'Holstein Cow', price: 1500 }).error).toBeUndefined(); });
  });

  describe('updateMarketplaceListingSchema', () => {
    it('accepts partial', () => { expect(updateMarketplaceListingSchema.validate({ price: 1800 }).error).toBeUndefined(); });
  });

  describe('placeBidSchema', () => {
    it('accepts valid', () => { expect(placeBidSchema.validate({ amount: 200 }).error).toBeUndefined(); });
  });

  describe('createMarketplaceOrderSchema', () => {
    it('accepts valid', () => { expect(createMarketplaceOrderSchema.validate({ listingId: u, quantity: 1 }).error).toBeUndefined(); });
  });

  describe('updateOrderStatusSchema', () => {
    it('accepts valid', () => { expect(updateOrderStatusSchema.validate({ status: 'shipped' }).error).toBeUndefined(); });
  });

  describe('createSustainabilityMetricSchema', () => {
    it('accepts valid', () => { expect(createSustainabilityMetricSchema.validate({ metricType: 'water', metricName: 'Water Usage', value: 500, unit: 'liters', periodStart: '2024-01-01', periodEnd: '2024-06-01' }).error).toBeUndefined(); });
  });

  describe('updateSustainabilityMetricSchema', () => {
    it('accepts partial', () => { expect(updateSustainabilityMetricSchema.validate({ value: 600 }).error).toBeUndefined(); });
  });

  describe('createSustainabilityGoalSchema', () => {
    it('accepts valid', () => { expect(createSustainabilityGoalSchema.validate({ goalName: 'Reduce Water', metricType: 'water_usage', targetValue: 400, targetDate: '2025-01-01' }).error).toBeUndefined(); });
  });

  describe('updateSustainabilityGoalSchema', () => {
    it('accepts partial', () => { expect(updateSustainabilityGoalSchema.validate({ currentValue: 450 }).error).toBeUndefined(); });
  });

  describe('createWellnessScorecardSchema', () => {
    it('accepts valid', () => { expect(createWellnessScorecardSchema.validate({ animalId: u, nutritionScore: 85, activityScore: 90 }).error).toBeUndefined(); });
    it('rejects score > 100', () => { expect(createWellnessScorecardSchema.validate({ animalId: u, nutritionScore: 150 }).error).toBeDefined(); });
    it('rejects invalid weightStatus', () => { expect(createWellnessScorecardSchema.validate({ animalId: u, weightStatus: 'unknown' }).error).toBeDefined(); });
  });

  describe('updateWellnessScorecardSchema', () => {
    it('accepts partial', () => { expect(updateWellnessScorecardSchema.validate({ activityScore: 70 }).error).toBeUndefined(); });
  });

  describe('createWellnessReminderSchema', () => {
    it('accepts valid', () => { expect(createWellnessReminderSchema.validate({ animalId: u, reminderType: 'vaccination', title: 'Annual vaccine', dueDate: '2024-07-01' }).error).toBeUndefined(); });
    it('accepts with recurrence', () => { expect(createWellnessReminderSchema.validate({ animalId: u, reminderType: 'checkup', title: 'Monthly checkup', dueDate: '2024-07-01', recurrence: 'monthly' }).error).toBeUndefined(); });
  });

  describe('snoozeReminderSchema', () => {
    it('accepts valid', () => { expect(snoozeReminderSchema.validate({ until: '2024-07-10' }).error).toBeUndefined(); });
    it('rejects missing until', () => { expect(snoozeReminderSchema.validate({}).error).toBeDefined(); });
  });

  describe('createGeofenceZoneSchema', () => {
    it('accepts valid', () => { expect(createGeofenceZoneSchema.validate({ name: 'Pasture A', zoneType: 'pasture', centerLat: 12.5, centerLng: 77.5, radiusMeters: 500 }).error).toBeUndefined(); });
    it('rejects lat > 90', () => { expect(createGeofenceZoneSchema.validate({ name: 'X', centerLat: 100 }).error).toBeDefined(); });
  });

  describe('updateGeofenceZoneSchema', () => {
    it('accepts partial', () => { expect(updateGeofenceZoneSchema.validate({ name: 'Updated Zone' }).error).toBeUndefined(); });
  });

  describe('createGeospatialEventSchema', () => {
    it('accepts valid', () => { expect(createGeospatialEventSchema.validate({ latitude: 12.5, longitude: 77.5, eventType: 'zone_entry' }).error).toBeUndefined(); });
    it('rejects out of range', () => { expect(createGeospatialEventSchema.validate({ latitude: 100, longitude: 77.5 }).error).toBeDefined(); });
  });

  describe('paginationSchema', () => {
    it('accepts defaults', () => { const { value, error } = paginationSchema.validate({}); expect(error).toBeUndefined(); expect(value.limit).toBe(10); });
    it('accepts custom', () => { expect(paginationSchema.validate({ limit: 50, offset: 10 }).error).toBeUndefined(); });
    it('rejects limit > 100', () => { expect(paginationSchema.validate({ limit: 200 }).error).toBeDefined(); });
    it('rejects negative offset', () => { expect(paginationSchema.validate({ offset: -1 }).error).toBeDefined(); });
  });

  describe('createHospitalSchema', () => {
    it('accepts valid', () => { expect(createHospitalSchema.validate({ name: 'VetCare Hospital', hospitalType: 'multi_specialty' }).error).toBeUndefined(); });
    it('rejects missing name', () => { expect(createHospitalSchema.validate({ hospitalType: 'clinic' }).error).toBeDefined(); });
  });

  describe('updateHospitalSchema', () => {
    it('accepts partial', () => { expect(updateHospitalSchema.validate({ name: 'Updated' }).error).toBeUndefined(); });
  });

  describe('addHospitalDoctorSchema', () => {
    it('accepts valid', () => { expect(addHospitalDoctorSchema.validate({ doctorId: u }).error).toBeUndefined(); });
  });

  describe('updateHospitalDoctorSchema', () => {
    it('accepts partial', () => { expect(updateHospitalDoctorSchema.validate({ hospitalRole: 'consultant' }).error).toBeUndefined(); });
  });

  describe('createDepartmentSchema', () => {
    it('accepts valid', () => { expect(createDepartmentSchema.validate({ name: 'Surgery' }).error).toBeUndefined(); });
  });

  describe('createHospitalServiceSchema', () => {
    it('accepts valid', () => { expect(createHospitalServiceSchema.validate({ serviceName: 'X-Ray', category: 'diagnostics' }).error).toBeUndefined(); });
  });

  describe('verifyHospitalSchema', () => {
    it('accepts valid', () => { expect(verifyHospitalSchema.validate({ verified: true }).error).toBeUndefined(); });
  });

  describe('uploadHospitalDocSchema', () => {
    it('accepts valid', () => { expect(uploadHospitalDocSchema.validate({ docType: 'pan', fileUrl: 'https://example.com/doc.pdf' }).error).toBeUndefined(); });
    it('rejects invalid docType', () => { expect(uploadHospitalDocSchema.validate({ docType: 'invalid' }).error).toBeDefined(); });
  });

  describe('reviewHospitalDocSchema', () => {
    it('accepts valid', () => { expect(reviewHospitalDocSchema.validate({ status: 'approved' }).error).toBeUndefined(); });
    it('rejects invalid status', () => { expect(reviewHospitalDocSchema.validate({ status: 'maybe' }).error).toBeDefined(); });
  });
});
