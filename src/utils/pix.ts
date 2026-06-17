function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixCode({
  pixKey,
  amount,
  merchantName,
  merchantCity,
  txId = "***",
}: {
  pixKey: string;
  amount: number;
  merchantName: string;
  merchantCity: string;
  txId?: string;
}): string {
  const merchantAccountInfo = emv(
    "26",
    emv("00", "BR.GOV.BCB.PIX") + emv("01", pixKey)
  );

  const additionalData = emv("62", emv("05", txId.slice(0, 25)));

  const payload =
    "000201" +
    merchantAccountInfo +
    "52040000" +
    "5303986" +
    emv("54", amount.toFixed(2)) +
    "5802BR" +
    emv("59", merchantName.slice(0, 25)) +
    emv("60", merchantCity.slice(0, 15)) +
    additionalData +
    "6304";

  return payload + crc16ccitt(payload);
}
