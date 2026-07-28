/**
 * Fixture mínimo estilo factura electrónica Air-e / UBL
 * (campos que el parser busca: PayableAmount, PaymentDueDate, IssueDate, NIC en texto)
 */
const SAMPLE_AIR_E_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID>DEFR66913937</cbc:ID>
  <cbc:IssueDate>2026-07-03</cbc:IssueDate>
  <cbc:PaymentDueDate>2026-07-09</cbc:PaymentDueDate>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>NIC2061151</cbc:ID>
      </cac:PartyIdentification>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="COP">472150.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>
`;

module.exports = { SAMPLE_AIR_E_XML };
