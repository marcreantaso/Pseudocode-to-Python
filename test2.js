const { PseudocodeCompiler } = require('./test_c.js');
const compiler = new PseudocodeCompiler();
const code = `BEGIN
  DECLARE number
  DISPLAY "Enter a number: "
  READ number
  IF number IS NOT A NUMBER THEN
    DISPLAY "Error"
  ELSE
    DISPLAY "You entered"
  ENDIF
END`;
const result = compiler.compile(code);
console.log(JSON.stringify(result, null, 2));
