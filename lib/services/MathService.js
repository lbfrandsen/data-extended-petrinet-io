export default class MathService {

    randomNormal(mean = 0, std = 1) {
        let u = 0, v = 0;

        // Avoid 0 values
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();

        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * std + mean;
    }

    randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    randomIntBetween(min, max) {
        console.log("RANDOM INT BETWEEN ", min, max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

