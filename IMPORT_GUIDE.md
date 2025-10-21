# Registration Import Guide

This guide explains how to import registration data from CSV or Excel files into the tournament management system.

## Overview

The import feature allows administrators to bulk import registration data from CSV or Excel files, making it easy to manage large numbers of registrations without manual entry.

## How to Use

### Step 1: Access the Import Feature
1. Navigate to **Admin Dashboard** → **Registrations**
2. Click the **"Import CSV/Excel"** button
3. The import modal will open

### Step 2: Upload Your File
1. Click **"Choose File"** and select your CSV or Excel file
2. Supported formats: `.csv`, `.xlsx`, `.xls`
3. Click **"Download Template CSV"** to get a sample file with the correct format

### Step 3: Select Tournament
1. Choose which tournament the registrations will be imported to
2. Click **"Continue to Field Mapping"**

### Step 4: Map Fields
1. The system will automatically try to map your CSV columns to registration fields
2. Review and adjust the mappings as needed
3. Required fields must be mapped for successful import
4. Click **"Preview Import"** to validate the data

### Step 5: Review and Import
1. Review the import preview showing valid and invalid records
2. Check validation errors and fix them in your source file if needed
3. Click **"Import X Registrations"** to complete the import

## CSV/Excel Format Requirements

### Required Columns
- **Name**: Participant's full name
- **Email**: Valid email address
- **Phone**: Contact phone number
- **Age**: Numeric age value
- **Gender**: male, female, or other
- **Tower**: Tower letter (A-P, except O and I)
- **Flat Number**: Flat/apartment number
- **Emergency Contact**: Emergency contact phone number
- **Expertise Level**: beginner, intermediate, advanced, or expert
- **Category**: Tournament category (e.g., mens-single, womens-single, etc.)

### Optional Columns
- **Partner Name**: For doubles/team events
- **Partner Phone**: Partner's contact number
- **Partner Email**: Partner's email address
- **Partner Tower**: Partner's tower
- **Partner Flat Number**: Partner's flat number
- **Payment Reference**: Payment reference number
- **Payment Method**: qr_code, cash, or bank_transfer
- **Payment Amount**: Payment amount in currency

## Sample CSV Format

```csv
Player's Name,Email,Phone,Age,Gender,Tower,Flat Number,Emergency Contact,Expertise Level,Category,Partner Name,Partner Phone,Payment Reference,Payment Method,Payment Amount
Vizai Kumar,vizai@example.com,9437527335,30,male,D,1901,9437527335,intermediate,mens-single,,,,564288371608,qr_code,500
Rohit Baheti,rohit@example.com,9966662741,28,male,M,703,9703858066,intermediate,open-team,Wife,9703858066,527970443102,qr_code,500
Hanvik Pendota,hanvik@example.com,9886391887,12,male,A,1511,9980199867,intermediate,kids-team-u13,,,,T2510061920402784410887,qr_code,500
Ruthvik Pendota,ruthvik@example.com,9886391887,16,male,A,1511,9980199867,intermediate,kids-team-u18,,,,T2510082147192165123812,qr_code,500
Monika Yadav,monika@example.com,7416622000,24,female,G,410,8885992000,intermediate,open-team,Ankur,8885992000,527924263809,qr_code,500
Saroja,saroja@example.com,9989769983,25,female,N,905,9989769983,beginner,open-team,Rajshekhar,9989769983,564526121553,qr_code,500
```

## Category Mapping

The system supports the following categories for import:

| Original Category | System Category | Description |
|------------------|-----------------|-------------|
| Team | open-team | Open team category for mixed teams |
| Boys/Girls under 13 Singles | kids-team-u13 | Kids team under 13 years |
| Boys/Girls under 18 Singles | kids-team-u18 | Kids team under 18 years |
| Men's/Women's Singles | mens-single / womens-single | Individual categories |
| Men's/Women's Doubles | mens-doubles / womens-doubles | Doubles categories |
| Men's/Women's Team | mens-team / womens-team | Gender-specific teams |

## Validation Rules

The system validates imported data against these rules:

- **Email**: Must contain "@" symbol
- **Age**: Must be a valid number
- **Gender**: Must be "male", "female", or "other"
- **Expertise Level**: Must be "beginner", "intermediate", "advanced", or "expert"
- **Required Fields**: All required fields must have values
- **Tournament Categories**: Must match valid tournament categories

## Data Extraction Notes

When importing from existing data sources:

1. **Gender Extraction**: Extract gender from "Additional Info" field (e.g., "Intermediate Male" → male)
2. **Level Extraction**: Extract expertise level from "Additional Info" field (e.g., "Intermediate Male" → intermediate)
3. **Age Estimation**: For missing ages, estimate based on category:
   - kids-team-u13: 10-12 years
   - kids-team-u18: 13-17 years
   - open-team: 18+ years
4. **Email Generation**: Generate emails using pattern: `{name}@example.com` for missing emails
5. **Partner Information**: Extract partner details from "Additional Info" field for team registrations

## Tips for Successful Import

1. **Use the Template**: Download the template CSV to ensure correct format
2. **Check Data Types**: Ensure age is numeric and other fields match expected values
3. **Validate Email**: Make sure all email addresses are properly formatted
4. **Consistent Values**: Use consistent values for gender, expertise level, and categories
5. **Test with Small Files**: Test with a small file first to verify the format works

## Troubleshooting

### Common Issues

1. **"Missing required field" errors**: Ensure all required columns are present and mapped
2. **"Invalid email format" errors**: Check that email addresses contain "@" symbol
3. **"Age must be a number" errors**: Ensure age column contains only numeric values
4. **"Gender must be male, female, or other" errors**: Check gender values are exactly as specified

### Getting Help

If you encounter issues:
1. Check the validation errors in the preview step
2. Download the template CSV and compare your format
3. Ensure your data matches the expected values exactly
4. Contact system administrator for additional support

## Import Process Flow

```
Upload File → Select Tournament → Map Fields → Preview & Validate → Import Data
```

Each step must be completed successfully before proceeding to the next step. The system will guide you through any errors or issues that need to be resolved.
