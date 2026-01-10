import * as XLSX from 'xlsx';

// Type for header mapping
type HeaderMap = { [key: string]: string };

// Generic export function
export const exportDataToExcel = <T extends object>(
    data: T[],
    filename: string,
    headerMap: HeaderMap
) => {
    const worksheetData = data.map(item => {
        const newItem: { [key: string]: any } = {};
        for (const key in headerMap) {
            if (Object.prototype.hasOwnProperty.call(item, key as keyof T)) {
                newItem[headerMap[key]] = item[key as keyof T];
            }
        }
        return newItem;
    });

    if (worksheetData.length === 0) {
        // For template download, create a sheet with only headers
        const headers = Object.values(headerMap);
        worksheetData.push(headers.reduce((acc, h) => ({...acc, [h]: ''}), {}));
    }

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Generic import function
export const importDataFromExcel = <T extends object>(file: File, headerMap: HeaderMap): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
                
                if (jsonData.length === 0) {
                    return reject(new Error('파일이 비어있거나 데이터가 없습니다.'));
                }

                // Validate headers
                const fileHeaders = Object.keys(jsonData[0]);
                const expectedHeaders = Object.values(headerMap);
                if (!expectedHeaders.every(h => fileHeaders.includes(h))) {
                    return reject(new Error(`필수 열이 누락되었습니다. (필수: ${expectedHeaders.join(', ')})`));
                }

                const importedData = jsonData.map(row => {
                    const newItem: { [key: string]: any } = {};
                    for (const key in headerMap) {
                         if (Object.prototype.hasOwnProperty.call(row, headerMap[key])) {
                            newItem[key] = row[headerMap[key]];
                         }
                    }
                    return newItem as T;
                });

                resolve(importedData);
            } catch (error) {
                console.error('엑셀 파일 처리 중 오류:', error);
                reject(new Error('엑셀 파일을 처리하는 중 오류가 발생했습니다.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
