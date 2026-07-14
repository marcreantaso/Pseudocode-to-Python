const fs = require('fs');
const code = `BEGIN
INPUT number
IF number > 0 THEN
    PRINT "Positive Number"
ELSE IF number < 0 THEN
    PRINT "Negative Number"
ELSE
    PRINT "Zero"
ENDIF
END`;

try {
   const validatePseudocode = require('./validate_test.js');
   const res = validatePseudocode(code);
   console.log("SUCCESS:", JSON.stringify(res, null, 2));
} catch (e) {
   console.error("EXCEPTION:", e.message);
   console.error(e.stack);
}
