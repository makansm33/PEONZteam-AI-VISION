/*
Shenzhen ACEBOTT Tech
modified from liusen
load dependency
"Acebott": "file:../pxt-Acebott"
*/

//% color="#6e5ba4" weight=20 icon="\uf085"
//% block="AI VISION"

namespace AIVISION {
    // Microbit K210  @start

    // 全局变量
    let set_mode = 0
    let x = 0      // X坐标
    let y = 0      // Y坐标
    let w = 0      // 宽度
    let h = 0      // 高度
    let cx = 0     // 中心点X坐标
    let cy = 0     // 中心点Y坐标
    let angle = 0  // 视觉巡线角度
    let tag = ""   // 识别内容
    let color_index = 0
    let red_value = 0
    let green_value = 0
    let blue_value = 0

    export enum RecognitionMode {
        //% block="qr code recogniton"
        QRCode = 2,
        //% block="barcode recognition"
        Barcode = 3,
        //% block="face recognition"
        Face = 4,
        //% block="image recognition"
        Image = 5,
        //% block="number recognition"
        Number = 6,
        //% block="traffic recognition: card"
        TrafficCard = 7,
        //% block="traffic recognition: sign plate"
        TrafficSign = 10,
        //% block="vision line following"
        VisualPatrol = 8,
        //% block="machine learning"
        MachineLearning = 9
    }

    export enum ColorSelection {
        //% block="All"
        All = 0,
        //% block="Red"
        Red = 1,
        //% block="Green"
        Green = 2,
        //% block="Blue"
        Blue = 3
    }

    export enum CodeData {
        //% block="X coordinate"
        X,
        //% block="Y coordinate"
        Y,
        //% block="width"
        W,
        //% block="height"
        H,
        //% block="Center X"
        CenterX,
        //% block="Center Y"
        CenterY,
        //% block="recognition result"
        Tag,
        //% block="line following result"
        Angle
    }

    //% blockId=K210_Init block="Visual module initialize"
    //% group="Microbit K210"
    //% weight=100
    export function K210_Init(): void {
        serial.setRxBufferSize(64);
        serial.redirect(
            SerialPin.P14,
            SerialPin.P15,
            BaudRate.BaudRate115200
        )
        set_mode = 0;
    }

    //% blockId=K210_Menu block="Visual module return to main menu"
    
    //% group="Microbit K210"
    //% weight=100
    export function K210_Menu(): void {
        if (set_mode != 0) {
            let data_send = pins.createBuffer(3)
            data_send.setNumber(NumberFormat.UInt8LE, 0, 0)
            data_send.setNumber(NumberFormat.UInt8LE, 1, 13)
            data_send.setNumber(NumberFormat.UInt8LE, 2, 10)
            serial.writeBuffer(data_send)
            basic.pause(100)
            set_mode = 0
        }
    }
    //% blockId=K210_RGB_lights block="Set Visual aRGB color R:%r G:%g B:%b"
    //% r.min=0 r.max=255
    //% g.min=0 g.max=255
    //% b.min=0 b.max=255
    //% weight=60
    //% group="Microbit K210"
    export function K210_RGB_lights(r: number, g: number, b: number): void {
        if (red_value != r || green_value != g || blue_value != b) {
            let data_send = pins.createBuffer(7)
            data_send.setNumber(NumberFormat.UInt8LE, 0, set_mode)
            data_send.setNumber(NumberFormat.UInt8LE, 1, 255)
            data_send.setNumber(NumberFormat.UInt8LE, 2, r)
            data_send.setNumber(NumberFormat.UInt8LE, 3, g)
            data_send.setNumber(NumberFormat.UInt8LE, 4, b)
            data_send.setNumber(NumberFormat.UInt8LE, 5, 13)
            data_send.setNumber(NumberFormat.UInt8LE, 6, 10)
            serial.writeBuffer(data_send)
            basic.pause(100)
        }
        red_value = r
        green_value = g
        blue_value = b
    }

    //% blockId=recognize_color block="color recognition %color"
    //% group="Microbit K210" 
    //% weight=95
    export function recognize_color(color: ColorSelection): boolean {
        // 模式切换检查（与Arduino完全一致）
        if (set_mode != 1 || color_index != color) {
            let data_send = pins.createBuffer(8);
            data_send.setNumber(NumberFormat.UInt8LE, 0, 1);       // set_mode
            data_send.setNumber(NumberFormat.UInt8LE, 1, color);   // color_index
            data_send.setNumber(NumberFormat.UInt8LE, 2, 600 >> 8); // area_threshold高字节
            data_send.setNumber(NumberFormat.UInt8LE, 3, 600 & 0xFF);// area_threshold低字节
            data_send.setNumber(NumberFormat.UInt8LE, 4, 100 >> 8); // pixels_threshold高字节
            data_send.setNumber(NumberFormat.UInt8LE, 5, 100 & 0xFF);// pixels_threshold低字节
            data_send.setNumber(NumberFormat.UInt8LE, 6, 13);      // CR
            data_send.setNumber(NumberFormat.UInt8LE, 7, 10);      // LF
            serial.writeBuffer(data_send);
            basic.pause(100);  // 与Arduino的delay(100)对应
            set_mode = 1;
            color_index = color;
        }

        // 数据接收与解析（关键修改点）
        let received = serial.readBuffer(0);
        if (received && received.length >= 12) {  // 最小有效长度=1(长度字节)+9(cx字段)+2(标签)
            let data_len = received.getNumber(NumberFormat.UInt8LE, 0);

            // 严格长度校验（与Arduino的while(available<data_len)等效）
            if (data_len < 9 || received.length < data_len + 1) {
                return false;
            }

            // 按Arduino协议手动解析（修复cx偏移量）
            x = (received.getNumber(NumberFormat.UInt8LE, 1) << 8) | received.getNumber(NumberFormat.UInt8LE, 2);
            y = received.getNumber(NumberFormat.UInt8LE, 3);
            w = (received.getNumber(NumberFormat.UInt8LE, 4) << 8) | received.getNumber(NumberFormat.UInt8LE, 5);
            h = received.getNumber(NumberFormat.UInt8LE, 6);
            cx = (received.getNumber(NumberFormat.UInt8LE, 7) << 8) | received.getNumber(NumberFormat.UInt8LE, 8); // 修正为第7-8字节
            cy = received.getNumber(NumberFormat.UInt8LE, 9);

            // 标签提取（与Arduino的String((char*)(UartBuff+9))等效）
            tag = "";
            for (let i = 10; i < data_len + 1; i++) {
                tag += String.fromCharCode(received.getNumber(NumberFormat.UInt8LE, i));
            }
            return true;
        }
        return false;
    }

    //% blockId=recognize_code block=" %mode"
    
    //% group="Microbit K210"
    //% weight=90
    export function recognize_code(mode: RecognitionMode): boolean {

        // 检查是否需要切换模式
        if (set_mode != mode) {
            // 交通标志特殊处理
            if (mode == RecognitionMode.TrafficCard || mode == RecognitionMode.TrafficSign) {
                let data_send = pins.createBuffer(4)
                data_send.setNumber(NumberFormat.UInt8LE, 0, 7)  // 固定包头7
                // 卡片=1, 标识牌=2
                data_send.setNumber(NumberFormat.UInt8LE, 1, mode == RecognitionMode.TrafficCard ? 1 : 2)
                data_send.setNumber(NumberFormat.UInt8LE, 2, 13)
                data_send.setNumber(NumberFormat.UInt8LE, 3, 10)
                serial.writeBuffer(data_send)
                set_mode = mode  // 注意这里设置为实际模式值(7或10)
            }
            // 其他模式
            else {
                let data_send = pins.createBuffer(3)
                data_send.setNumber(NumberFormat.UInt8LE, 0, mode)
                data_send.setNumber(NumberFormat.UInt8LE, 1, 13)
                data_send.setNumber(NumberFormat.UInt8LE, 2, 10)
                serial.writeBuffer(data_send)
                set_mode = mode
            }
            basic.pause(100)
        }

        // 数据处理
        let available = serial.readBuffer(0)
        if (available && available.length > 0) {
            const currentTime = input.runningTime();
            const currentData = available.toHex();

            let data_len = available.getNumber(NumberFormat.UInt8LE, 0)

            if (available.length >= data_len + 1) {
                let payload = available.slice(2, data_len);
                x = (available.getNumber(NumberFormat.UInt8LE, 1) << 8) | available.getNumber(NumberFormat.UInt8LE, 2);
                y = available.getNumber(NumberFormat.UInt8LE, 3);
                w = (available.getNumber(NumberFormat.UInt8LE, 4) << 8) | available.getNumber(NumberFormat.UInt8LE, 5);
                h = available.getNumber(NumberFormat.UInt8LE, 6);
                if (mode == RecognitionMode.Face) {
                    cx = available.getNumber(NumberFormat.UInt16LE, 7)
                    cy = available.getNumber(NumberFormat.UInt8LE, 9)
                }
                tag = ""
                switch (mode) {
                    case RecognitionMode.VisualPatrol:
                        angle = available.getNumber(NumberFormat.UInt8LE, 1) - 60
                        return true
                    case RecognitionMode.MachineLearning:
                    case RecognitionMode.Number:
                        tag = available.getNumber(NumberFormat.UInt8LE, 1).toString()
                        return true

                    case RecognitionMode.Image:
                        for (let n = 10; n < data_len + 1; n++) {
                            tag += String.fromCharCode(available.getNumber(NumberFormat.UInt8LE, n))
                        }
                        return true
                    case RecognitionMode.Face:
                        for (let n = 10; n < data_len + 1; n++) {
                            tag += available.getNumber(NumberFormat.UInt8LE, 10)
                        }
                        return true

                    case RecognitionMode.Barcode:
                    case RecognitionMode.QRCode:
                        for (let m = 7; m < Math.min(data_len + 1, available.length); m++) {
                            tag += String.fromCharCode(available.getNumber(NumberFormat.UInt8LE, m));
                        }
                        return true;

                    case RecognitionMode.TrafficCard:
                    case RecognitionMode.TrafficSign:

                        for (let i = 10; i < Math.min(data_len + 1, available.length); i++) {
                            tag += String.fromCharCode(available.getNumber(NumberFormat.UInt8LE, i));
                        }
                        return true
                }
            }
        }
        return false
    }

    //% blockId=clearSerialBuffer block="clear serial buffer"
    //% group="Microbit K210"
    //% weight=85
    export function clearSerialBuffer(): void {
        while (serial.readBuffer(0) && serial.readBuffer(0).length > 0) {
            serial.readBuffer(0);
        }
    }

    //% blockId=get_code_data block="get %data"
    //% group="Microbit K210"
    //% weight=85
    export function get_code_data(data: CodeData): string {
        switch (data) {
            case CodeData.X: return x.toString()
            case CodeData.Y: return y.toString()
            case CodeData.W: return w.toString()
            case CodeData.H: return h.toString()
            case CodeData.CenterX: return cx.toString()
            case CodeData.CenterY: return cy.toString()
            case CodeData.Tag: return tag
            case CodeData.Angle: return angle.toString()
            default: return "0"
        }

    }

// Microbit K210  @end

}
