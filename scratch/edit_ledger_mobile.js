const fs = require('fs');

const filePath = 'd:\\KSK\\HOST\\KSK REACT\\KSK1\\V_1 - Main\\mobile\\src\\screens\\admin\\CustomerLedgerScreen.js';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Declare state variables at the beginning (around line 255)
const stateTarget = "  const [showReportToPicker, setShowReportToPicker] = useState(false);\n  const [isReportActive, setIsReportActive] = useState(false);";
const stateReplacement = "  const [showReportToPicker, setShowReportToPicker] = useState(false);\n  const [isReportActive, setIsReportActive] = useState(false);\n  const [ledgerPageSize, setLedgerPageSize] = useState('a5'); // 'a5' or 'a4'";

if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
    console.log("Injected ledgerPageSize state variable.");
} else {
    console.log("Error: stateTarget not found!");
}

// 2. Add selector UI to Report Modal (before Save/Generate button around line 3726)
const uiTarget = `              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.primary, marginTop: 15 }]}
                onPress={handleGenerateReport}
              >`;
const uiReplacement = `              <Text style={styles.formLabel}>Select Paper Size</Text>
              <View style={{ display: 'flex', flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <Pressable
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: ledgerPageSize === 'a4' ? '#0f52ba' : '#cbd5e1',
                    backgroundColor: ledgerPageSize === 'a4' ? '#0f52ba' : '#fff',
                    alignItems: 'center'
                  }}
                  onPress={() => setLedgerPageSize('a4')}
                >
                  <Text style={{ color: ledgerPageSize === 'a4' ? '#fff' : '#1e293b', fontWeight: 'bold' }}>A4 Size</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: ledgerPageSize === 'a5' ? '#0f52ba' : '#cbd5e1',
                    backgroundColor: ledgerPageSize === 'a5' ? '#0f52ba' : '#fff',
                    alignItems: 'center'
                  }}
                  onPress={() => setLedgerPageSize('a5')}
                >
                  <Text style={{ color: ledgerPageSize === 'a5' ? '#fff' : '#1e293b', fontWeight: 'bold' }}>A5 Size</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.confirmBtn, { backgroundColor: colors.primary, marginTop: 15 }]}
                onPress={handleGenerateReport}
              >`;

if (content.includes(uiTarget)) {
    content = content.replace(uiTarget, uiReplacement);
    console.log("Injected A4/A5 selection UI into report modal.");
} else {
    console.log("Error: uiTarget not found!");
}

// 3. Make generateStatementHtml and printable methods dynamic
// Update generateStatementHtml signature
const funcSigTarget = "  const generateStatementHtml = (fromDate, toDate) => {";
const funcSigReplacement = `  const generateStatementHtml = (fromDate, toDate, pageSize = 'a5') => {
    const isA4 = pageSize === 'a4';`;

if (content.includes(funcSigTarget)) {
    content = content.replace(funcSigTarget, funcSigReplacement);
    console.log("Updated generateStatementHtml signature to accept pageSize.");
} else {
    console.log("Error: funcSigTarget not found!");
}

// Update the A5 metrics variables at the top of generateStatementHtml to be conditional
const helperVarsTarget = `    const fontSz12 = '9.5px';
    const fontSz13 = '10.5px';
    const fontSz14 = '11.5px';
    const pad10_8 = '6px 5px';
    const pad8_8 = '5px 5px 0 5px';
    const pad0_8 = '0 5px 4px 5px';
    const padRightVal = '15px';`;

const helperVarsReplacement = `    const fontSz12 = isA4 ? '12px' : '9.5px';
    const fontSz13 = isA4 ? '13px' : '10.5px';
    const fontSz14 = isA4 ? '14px' : '11.5px';
    const pad10_8 = isA4 ? '10px 8px' : '6px 5px';
    const pad8_8 = isA4 ? '8px 8px 0 8px' : '5px 5px 0 5px';
    const pad0_8 = isA4 ? '0 8px 6px 8px' : '0 5px 4px 5px';
    const padRightVal = isA4 ? '30px' : '15px';`;

if (content.includes(helperVarsTarget)) {
    content = content.replace(helperVarsTarget, helperVarsReplacement);
    console.log("Updated helper styling variables to be conditional.");
} else {
    console.log("Error: helperVarsTarget not found!");
}

// 4. Make CSS rules inside generateStatementHtml dynamic
content = content.replace("size: auto;\n            margin: 4mm 6mm;", "size: ${pageSize === 'a4' ? 'A4' : 'A5'} portrait;\n            margin: ${pageSize === 'a4' ? '8mm 12mm' : '4mm 6mm'};");
content = content.replace("font-size: 9.5px;\n            line-height: 1.4;", "font-size: ${pageSize === 'a4' ? '11px' : '9.5px'};\n            line-height: 1.4;");
content = content.replace("padding: 0 15px;", "padding: ${pageSize === 'a4' ? '0 30px' : '0 15px'};");
content = content.replace("height: 48px;\n            background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);\n            color: #ffffff;\n            padding: 8px 15px;", "height: ${pageSize === 'a4' ? '60px' : '48px'};\n            background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);\n            color: #ffffff;\n            padding: ${pageSize === 'a4' ? '12px 30px' : '8px 15px'};");
content = content.replace("height: 26px;\n            background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);\n            color: #ffffff;\n            padding: 4px 15px;", "height: ${pageSize === 'a4' ? '32px' : '26px'};\n            background: linear-gradient(135deg, #11998e 0%, #0f52ba 100%);\n            color: #ffffff;\n            padding: ${pageSize === 'a4' ? '6px 30px' : '4px 15px'};");
content = content.replace("font-size: 16px;", "font-size: ${pageSize === 'a4' ? '24px' : '16px'};");
content = content.replace("font-size: 9.5px;\n            opacity: 0.9;\n            font-weight: 500;", "font-size: ${pageSize === 'a4' ? '11px' : '9.5px'};\n            opacity: 0.9;\n            font-weight: 500;");
content = content.replace("font-size: 8px;\n            font-weight: 500;", "font-size: ${pageSize === 'a4' ? '10px' : '8px'};\n            font-weight: 500;");
content = content.replace("font-size: 9.0px;\n            font-weight: bold;\n            letter-spacing: 0.3px;\n            text-align: left;", "font-size: ${pageSize === 'a4' ? '11.5px' : '9.0px'};\n            font-weight: bold;\n            letter-spacing: 0.3px;\n            text-align: left;");
content = content.replace("font-size: 8.5px;\n            font-weight: 500;\n            opacity: 0.9;\n            text-align: right;", "font-size: ${pageSize === 'a4' ? '10.5px' : '8.5px'};\n            font-weight: 500;\n            opacity: 0.9;\n            text-align: right;");

// profile section dynamic layout
content = content.replace(".profile-section {\n            display: flex;\n            flex-direction: row;\n            flex-wrap: wrap;\n            justify-content: space-between;\n            gap: 15px;\n            margin-bottom: 15px;\n          }", ".profile-section {\n            display: flex;\n            flex-direction: row;\n            flex-wrap: ${pageSize === 'a4' ? 'nowrap' : 'wrap'};\n            justify-content: space-between;\n            gap: ${pageSize === 'a4' ? '20px' : '15px'};\n            margin-bottom: ${pageSize === 'a4' ? '20px' : '15px'};\n          }");
content = content.replace(".profile-card {\n            flex: 1;\n            min-width: 200px;\n            background-color: #f8fafc;\n            border: 1px solid #e2e8f0;\n            border-radius: 8px;\n            padding: 12px;\n          }", ".profile-card {\n            flex: 1;\n            min-width: ${pageSize === 'a4' ? 'auto' : '200px'};\n            background-color: #f8fafc;\n            border: 1px solid #e2e8f0;\n            border-radius: 8px;\n            padding: ${pageSize === 'a4' ? '16px' : '12px'};\n          }");

// Spacer heights dynamic calculation
content = content.replace("<td style=\"border: none; padding: 0; height: 68px;\"></td>", "<td style=\"border: none; padding: 0; height: ${pageSize === 'a4' ? '85px' : '68px'};\"></td>");
content = content.replace("<td style=\"border: none; padding: 0; height: 48px;\"></td>", "<td style=\"border: none; padding: 0; height: ${pageSize === 'a4' ? '65px' : '48px'};\"></td>");

// 5. Update handleDownloadStatement and handleShareStatement to read ledgerPageSize
content = content.replace("generateStatementHtml(fromDate, toDate);", "generateStatementHtml(fromDate, toDate, ledgerPageSize);");
// also for share
content = content.replace("generateStatementHtml(fromDate, toDate);", "generateStatementHtml(fromDate, toDate, ledgerPageSize);");

// Update printToFileAsync in handleShareStatement
const shareFileTarget = `      const { uri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842
      });`;
const shareFileReplacement = `      const { uri } = await Print.printToFileAsync({
        html,
        width: ledgerPageSize === 'a4' ? 595 : 420,
        height: ledgerPageSize === 'a4' ? 842 : 595
      });`;

if (content.includes(shareFileTarget)) {
    content = content.replace(shareFileTarget, shareFileReplacement);
    console.log("Updated printToFileAsync in handleShareStatement.");
} else {
    console.log("Error: shareFileTarget not found!");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done patching CustomerLedgerScreen.js");
