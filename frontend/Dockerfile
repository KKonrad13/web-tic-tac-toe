FROM busybox:1.35

ARG IP
ARG API_GATEWAY_URL

ENV IP=${IP}
ENV API_GATEWAY_URL=${API_GATEWAY_URL}

RUN adduser -D stud
USER stud
WORKDIR /home/stud

COPY src/ .

RUN sed -i "s/localhost/$IP/g" index.html && \
    sed -i "s/localhost/$IP/g" game.js && \
    sed -i "s/localhost/$IP/g" authorize.js && \
    sed -i "s|API_GATEWAY_URL|$API_GATEWAY_URL|g" index.html && \
    sed -i "s|API_GATEWAY_URL|$API_GATEWAY_URL|g" game.js

ENTRYPOINT ["busybox"]
CMD ["httpd", "-f", "-v", "-p", "3000"]